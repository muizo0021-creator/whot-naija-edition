
import React, { useEffect, useRef, useState } from 'react';
import { GameState, GameStatus } from '../types';

interface AudioManagerProps {
  gameState: GameState | null;
}

const AUDIO_URLS = {
  NORMAL: 'https://assets.mixkit.co/music/preview/mixkit-island-beat-250.mp3',
  TENSE: 'https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3',
  STREET_AMBIENCE: 'https://assets.mixkit.co/music/preview/mixkit-street-market-ambience-442.mp3',
  VICTORY: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2064.mp3',
  DEFEAT: 'https://assets.mixkit.co/sfx/preview/mixkit-lose-negative-game-tone-2840.mp3',
  CARD_PLAY: 'https://assets.mixkit.co/sfx/preview/mixkit-poker-card-flick-2002.mp3',
  CARD_DRAW: 'https://assets.mixkit.co/sfx/preview/mixkit-card-game-shuffle-2130.mp3',
  WHOT_PLAY: 'https://assets.mixkit.co/sfx/preview/mixkit-magic-sweep-game-alert-2773.mp3',
  WARNING: 'https://assets.mixkit.co/sfx/preview/mixkit-clock-ticking-second-hand-1065.mp3'
};

const AudioManager: React.FC<AudioManagerProps> = ({ gameState }) => {
  const normalAudio = useRef<HTMLAudioElement | null>(null);
  const tenseAudio = useRef<HTMLAudioElement | null>(null);
  const ambienceAudio = useRef<HTMLAudioElement | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = () => {
      if (!isInitialized) {
        normalAudio.current = new Audio(AUDIO_URLS.NORMAL);
        normalAudio.current.loop = true;
        normalAudio.current.volume = 0.3;

        tenseAudio.current = new Audio(AUDIO_URLS.TENSE);
        tenseAudio.current.loop = true;
        tenseAudio.current.volume = 0;

        ambienceAudio.current = new Audio(AUDIO_URLS.STREET_AMBIENCE);
        ambienceAudio.current.loop = true;
        ambienceAudio.current.volume = 0.1;

        normalAudio.current.play().catch(() => {});
        ambienceAudio.current.play().catch(() => {});
        tenseAudio.current.play().catch(() => {});

        setIsInitialized(true);
      }
    };

    window.addEventListener('click', init);
    window.addEventListener('touchstart', init);
    return () => {
      window.removeEventListener('click', init);
      window.removeEventListener('touchstart', init);
    };
  }, [isInitialized]);

  // Turn Warning SFX
  useEffect(() => {
      if (gameState?.turnTimeLeft === 5 && gameState.currentPlayerIndex === 0 && isInitialized && !gameState.dataSaver) {
          const warn = new Audio(AUDIO_URLS.WARNING);
          warn.volume = 0.5;
          warn.play().catch(() => {});
      }
  }, [gameState?.turnTimeLeft, gameState?.currentPlayerIndex, isInitialized]);

  // SFX Triggers
  useEffect(() => {
    if (!gameState || !isInitialized || gameState.dataSaver || !gameState.lastActionTrigger) return;

    const sfx = new Audio(AUDIO_URLS[gameState.lastActionTrigger as keyof typeof AUDIO_URLS] || AUDIO_URLS.CARD_PLAY);
    sfx.volume = 0.6;
    sfx.play().catch(() => {});
  }, [gameState?.lastActionTrigger, isInitialized]);

  // Music Fades
  useEffect(() => {
    if (!gameState || !isInitialized || gameState.dataSaver) {
      [normalAudio, tenseAudio, ambienceAudio].forEach(ref => { if (ref.current) ref.current.volume = 0; });
      return;
    }

    const isTense = gameState.pendingPicks > 0 || gameState.players.some(p => p.hand.length <= 2);

    if (gameState.status === GameStatus.PLAYING) {
      fade(normalAudio.current, isTense ? 0 : 0.3);
      fade(tenseAudio.current, isTense ? 0.4 : 0);
      fade(ambienceAudio.current, 0.1);
    } else if (gameState.status === GameStatus.FINISHED) {
      [normalAudio, tenseAudio, ambienceAudio].forEach(ref => { if (ref.current) fade(ref.current, 0); });
      const winSfx = new Audio(gameState.winnerId === 'player-1' ? AUDIO_URLS.VICTORY : AUDIO_URLS.DEFEAT);
      winSfx.volume = 0.6;
      winSfx.play().catch(() => {});
    }
  }, [gameState?.status, gameState?.pendingPicks, gameState?.dataSaver, isInitialized]);

  const fade = (audio: HTMLAudioElement | null, target: number) => {
    if (!audio) return;
    const step = 0.05;
    const interval = setInterval(() => {
      if (audio.volume < target) audio.volume = Math.min(target, audio.volume + step);
      else if (audio.volume > target) audio.volume = Math.max(target, audio.volume - step);
      else clearInterval(interval);
      if (Math.abs(audio.volume - target) < 0.01) {
          audio.volume = target;
          clearInterval(interval);
      }
    }, 50);
  };

  return null;
};

export default AudioManager;
