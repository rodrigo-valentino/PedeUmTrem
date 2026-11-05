/**
 * RF49 / RF55 / Seção 11 — Alerta sonoro de novos pedidos (Lojista) e de novas entregas (Entregador)
 * via Web Audio API, além de Notificações Push do navegador.
 */

let audioCtx: AudioContext | null = null;

export function unlockMerchantAudio(): boolean {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    playToneSequence([
      { freq: 587.33, duration: 0.1, delay: 0 },
      { freq: 880, duration: 0.16, delay: 0.11 },
    ]);
    return true;
  } catch {
    return false;
  }
}

export function unlockDriverAudio(): boolean {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    playToneSequence([
      { freq: 523.25, duration: 0.09, delay: 0 },
      { freq: 659.25, duration: 0.09, delay: 0.1 },
      { freq: 783.99, duration: 0.15, delay: 0.2 },
    ]);
    return true;
  } catch {
    return false;
  }
}

export function playNewOrderSound(): void {
  try {
    playToneSequence([
      { freq: 659.25, duration: 0.14, delay: 0 },
      { freq: 783.99, duration: 0.14, delay: 0.16 },
      { freq: 1046.5, duration: 0.26, delay: 0.32 },
      { freq: 783.99, duration: 0.14, delay: 0.65 },
      { freq: 1046.5, duration: 0.32, delay: 0.82 },
    ]);
  } catch {
    // Ignorar caso o áudio ainda não tenha sido desbloqueado
  }
}

/**
 * Alerta sonoro distinto para os Entregadores quando chega uma nova entrega na fila (RF55)
 */
export function playNewDeliveryRideSound(): void {
  try {
    playToneSequence([
      { freq: 587.33, duration: 0.12, delay: 0 },
      { freq: 880.0, duration: 0.12, delay: 0.14 },
      { freq: 1174.66, duration: 0.22, delay: 0.28 },
      { freq: 880.0, duration: 0.12, delay: 0.56 },
      { freq: 1174.66, duration: 0.28, delay: 0.7 },
    ]);
  } catch {
    // Ignorar caso o áudio ainda não tenha sido desbloqueado
  }
}

function playToneSequence(
  notes: Array<{ freq: number; duration: number; delay: number }>
): void {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;
  for (const note of notes) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note.freq, now + note.delay);

    gain.gain.setValueAtTime(0.001, now + note.delay);
    gain.gain.exponentialRampToValueAtTime(0.28, now + note.delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + note.delay + note.duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now + note.delay);
    osc.stop(now + note.delay + note.duration + 0.02);
  }
}

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export function triggerPushNotification(title: string, body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
      });
    } catch {
      // Fallback silencioso em navegadores móveis que exigem SW ativo
    }
  }
}
