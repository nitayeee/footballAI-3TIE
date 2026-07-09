import os
import numpy as np
import pandas as pd
import joblib
import onnxruntime as ort

# Global references (lazy loaded)
model = None
scaler = None
df = None
team_df = None
teams = []
stats = {}
TIMESTEPS = 5
N_FEATURES = 11

# Try parent directory first (local PC), then current repository folder (VPS fallback)
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEL2_DIR = os.path.join(base_dir, "Kel_2")
if not os.path.exists(KEL2_DIR) or not os.path.exists(os.path.join(KEL2_DIR, 'epl_final.csv')):
    repo_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    KEL2_DIR = os.path.join(repo_dir, "Kel_2")

CSV_PATH = os.path.join(KEL2_DIR, 'epl_final.csv')
SCALER_PATH = os.path.join(KEL2_DIR, 'scaler.pkl')
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
MODEL_PATH = os.path.join(MODELS_DIR, 'lstm_epl_model.onnx')
FEATURE_COLS = ['Result','GoalsFor','GoalsAgainst','SOTFor','SOTAgainst','IsHome',
                'FormResult','AvgGoalsFor','AvgGoalsAgst','AvgSOTFor','WinRate']

def load_resources():
    global model, scaler, df, team_df, teams, stats, TIMESTEPS
    if model is not None:
        return
        
    print("[1/4] Loading EPL data...")
    df = pd.read_csv(CSV_PATH)
    df['MatchDate'] = pd.to_datetime(df['MatchDate'])
    df = df.sort_values('MatchDate').reset_index(drop=True)
    
    # Build team_df with 11 features
    home = pd.DataFrame({
        'Date': df['MatchDate'], 'Team': df['HomeTeam'], 'IsHome': 1,
        'GoalsFor': df['FullTimeHomeGoals'], 'GoalsAgainst': df['FullTimeAwayGoals'],
        'SOTFor': df['HomeShotsOnTarget'], 'SOTAgainst': df['AwayShotsOnTarget'],
    })
    home['Result'] = np.select(
        [df['FullTimeResult']=='H', df['FullTimeResult']=='A'], [2, 0], default=1)
    
    away = pd.DataFrame({
        'Date': df['MatchDate'], 'Team': df['AwayTeam'], 'IsHome': 0,
        'GoalsFor': df['FullTimeAwayGoals'], 'GoalsAgainst': df['FullTimeHomeGoals'],
        'SOTFor': df['AwayShotsOnTarget'], 'SOTAgainst': df['HomeShotsOnTarget'],
    })
    away['Result'] = np.select(
        [df['FullTimeResult']=='A', df['FullTimeResult']=='H'], [2, 0], default=1)
    
    team_df = pd.concat([home, away]).sort_values(['Team','Date']).reset_index(drop=True)
    
    N = 5
    grp = team_df.groupby('Team')
    team_df['FormResult']   = grp['Result'].transform(lambda s: s.shift(1).rolling(N, min_periods=1).mean())
    team_df['AvgGoalsFor']  = grp['GoalsFor'].transform(lambda s: s.shift(1).rolling(N, min_periods=1).mean())
    team_df['AvgGoalsAgst'] = grp['GoalsAgainst'].transform(lambda s: s.shift(1).rolling(N, min_periods=1).mean())
    team_df['AvgSOTFor']    = grp['SOTFor'].transform(lambda s: s.shift(1).rolling(N, min_periods=1).mean())
    team_df['WinRate']      = grp['Result'].transform(lambda s: (s==2).shift(1).rolling(N, min_periods=1).mean())
    team_df = team_df.fillna(0)
    
    print("[2/4] Loading EPL scaler...")
    scaler = joblib.load(SCALER_PATH)
    
    print("[3/4] Loading EPL LSTM model...")
    model = ort.InferenceSession(MODEL_PATH)
    TIMESTEPS = model.get_inputs()[0].shape[1]
    
    teams = sorted(team_df['Team'].unique().tolist())
    
    print("[4/4] Computing team stats...")
    def compute_stats(team):
        h = df[df['HomeTeam']==team]
        a = df[df['AwayTeam']==team]
        total = len(h) + len(a)
        wins   = len(h[h['FullTimeResult']=='H']) + len(a[a['FullTimeResult']=='A'])
        draws  = len(df[((df['HomeTeam']==team)|(df['AwayTeam']==team)) & (df['FullTimeResult']=='D')])
        losses = total - wins - draws
        gf = int(h['FullTimeHomeGoals'].sum() + a['FullTimeAwayGoals'].sum())
        ga = int(h['FullTimeAwayGoals'].sum() + a['FullTimeHomeGoals'].sum())
        matches = df[(df['HomeTeam']==team)|(df['AwayTeam']==team)].tail(5)
        recent = []
        for _, r in matches.iterrows():
            if r['HomeTeam']==team:
                recent.append('W' if r['FullTimeResult']=='H' else ('D' if r['FullTimeResult']=='D' else 'L'))
            else:
                recent.append('W' if r['FullTimeResult']=='A' else ('D' if r['FullTimeResult']=='D' else 'L'))
        return {
            'wins': int(wins), 'draws': int(draws), 'losses': int(losses), 'total': int(total),
            'win_pct': round(wins/total*100, 1) if total else 0,
            'goals_for': gf, 'goals_against': ga, 'recent': recent
        }
        
    stats = {t: compute_stats(t) for t in teams}
 
def get_teams():
    load_resources()
    return teams
 
def predict_epl_match(team):
    load_resources()
    if team not in set(team_df['Team']):
        return {'error': 'Tim tidak ditemukan'}
        
    g = team_df[team_df['Team']==team].sort_values('Date')
    if len(g) < TIMESTEPS:
        return {'error': f'Data tidak cukup (butuh minimal {TIMESTEPS} match)'}
        
    window = g[FEATURE_COLS].values.astype(float)[-TIMESTEPS:]
    window_scaled = scaler.transform(window).reshape(1, TIMESTEPS, N_FEATURES)
    input_name = model.get_inputs()[0].name
    proba = model.run(None, {input_name: window_scaled.astype(np.float32)})[0][0]
    
    last5 = g.tail(TIMESTEPS)[['Date','GoalsFor','GoalsAgainst','SOTFor','Result']].copy()
    recent = []
    for _, row in last5.iterrows():
        r = int(row['Result'])
        recent.append({
            'date': str(row['Date'])[:10],
            'goals_for': int(row['GoalsFor']),
            'goals_against': int(row['GoalsAgainst']),
            'sot': int(row['SOTFor']),
            'result': ['Kalah','Seri','Menang'][r],
            'result_code': r
        })
        
    return {
        'success': True,
        'team': team,
        'prob_loss':  round(float(proba[0])*100, 1),
        'prob_draw':  round(float(proba[1])*100, 1),
        'prob_win':   round(float(proba[2])*100, 1),
        'prediction': ['Kalah','Seri','Menang'][int(proba.argmax())],
        'recent_matches': recent,
    }
