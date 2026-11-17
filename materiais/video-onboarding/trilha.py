import numpy as np, wave, sys
SR = 44100
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 70.0
BPM = 84
beat = 60 / BPM
n = int(SR * DUR)
L = np.zeros(n); R = np.zeros(n)
rng = np.random.default_rng(7)
def nota(m): return 440 * 2 ** ((m - 69) / 12)
def env(N, a, r):
    e = np.ones(N); na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def add(buf, start, sig, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= n: return
    sig = sig[: n - i] * gain
    L[i:i+len(sig)] += sig * (1 - pan) / 2 * 2 ** 0.5 * 0.71
    R[i:i+len(sig)] += sig * (1 + pan) / 2 * 2 ** 0.5 * 0.71
acordes = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59, 62]]
baixo = [41, 40, 38, 36]
comp = 4 * beat
t = 0.0; k = 0
while t < DUR:
    ac = acordes[k % 4]; dur = 2 * comp
    N = int(dur * SR) + int(1.5 * SR); tt = np.arange(N) / SR
    pad = np.zeros(N)
    for m in ac:
        f = nota(m + 12)
        for d in (-0.004, 0.004): pad += np.sin(2 * np.pi * f * (1 + d) * tt) * 0.5
    pad *= (0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * tt)); pad *= env(N, 1.2, 1.6) * 0.045
    add(L, t, pad, pan=-0.2)
    fb = nota(baixo[k % 4])
    for b in range(2):
        Nb = int(comp * SR); tb = np.arange(Nb) / SR
        bs = (np.sin(2 * np.pi * fb * tb) + 0.3 * np.sin(2 * np.pi * 2 * fb * tb)) * np.exp(-tb * 1.2) * env(Nb, 0.02, 0.3) * 0.12
        add(L, t + b * comp, bs)
    for s in range(16):
        if rng.random() < 0.35: continue
        m = ac[(s * 2 + k) % len(ac)] + 24
        Np = int(0.9 * SR); tp = np.arange(Np) / SR; f = nota(m)
        pl = (np.sin(2 * np.pi * f * tp) + 0.25 * np.sin(2 * np.pi * 2 * f * tp + 0.3)) * np.exp(-tp * 4.5) * env(Np, 0.004, 0.2)
        add(L, t + s * beat / 2 + rng.normal(0, 0.008), pl, pan=0.35 * np.sin(s), gain=0.05 * (0.7 + 0.3 * rng.random()))
    t += dur; k += 1
t = 0.0
Nk = int(0.35 * SR); tk = np.arange(Nk) / SR
kick = np.sin(2 * np.pi * (52 + 70 * np.exp(-tk * 30)) * tk) * np.exp(-tk * 9) * 0.22
Nh = int(0.06 * SR)
while t < DUR:
    for s in range(8):
        tt0 = t + s * beat / 2
        if s in (0, 4) and t > 3.0: add(L, tt0, kick)
        if t > 3.0:
            hat = rng.normal(0, 1, Nh) * np.exp(-np.arange(Nh) / SR * 60)
            hat = np.diff(np.concatenate([[0], hat]))
            add(L, tt0 + 0.012, hat, pan=0.3, gain=0.012 if s % 2 else 0.02)
    t += comp
L += rng.normal(0, 0.0025, n); R += rng.normal(0, 0.0025, n)
for d, g in ((0.11, 0.25), (0.23, 0.15), (0.37, 0.08)):
    s = int(d * SR); L[s:] += R[:-s] * g; R[s:] += L[:-s] * g
fade = np.ones(n); fi, fo = int(1.5 * SR), int(3.0 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
L *= fade; R *= fade
pico = max(np.abs(L).max(), np.abs(R).max()); L, R = L / pico * 0.8, R / pico * 0.8
st = np.stack([L, R], axis=1)
with wave.open('trilha.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
print('ok', DUR)
