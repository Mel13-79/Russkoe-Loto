import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Play, Trophy, LogOut, Hash, LayoutGrid, Settings2, Timer, X } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Types ---
type Card = (number | null)[][];

interface Player {
  id: string;
  username: string;
  cards: Card[];
  ready: boolean;
}

interface Room {
  id: string;
  players: Player[];
  drawnNumbers: number[];
  status: 'waiting' | 'playing' | 'finished';
  lastNumber: number | null;
}

// --- Components ---

interface LottoCardProps {
  card: Card;
  drawnNumbers: number[];
  onMark: (num: number) => void;
  marked: Set<number>;
}

const LottoCard = ({ card, onMark, marked }: LottoCardProps) => {
  return (
    <div className="bg-[#f4e4bc] p-3 rounded-lg shadow-xl border-4 border-[#8b4513] select-none relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-[#8b4513]/20" />
      <div className="grid grid-cols-9 gap-1.5">
        {card.map((row, rIdx) =>
          row.map((num, cIdx) => {
            const isMarked = num !== null && marked.has(num);
            return (
              <div
                key={`${rIdx}-${cIdx}`}
                onClick={() => num && onMark(num)}
                className={`
                  h-10 w-10 sm:h-14 sm:w-14 flex items-center justify-center rounded-md text-xl font-black transition-all duration-300 relative
                  ${!num ? 'bg-transparent' : 
                    isMarked ? 'bg-red-700 text-white shadow-inner scale-90 rotate-3' : 
                    'bg-white text-stone-800 shadow-md border-b-4 border-stone-300'}
                `}
              >
                {num}
                {isMarked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="w-full h-1 bg-white/30 rotate-45 absolute" />
                    <div className="w-full h-1 bg-white/30 -rotate-45 absolute" />
                  </motion.div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [markedNumbers, setMarkedNumbers] = useState<Set<number>>(new Set());
  const [winner, setWinner] = useState<{ username: string; type: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [drawInterval, setDrawInterval] = useState(4000);
  const [soundEnabled, setSoundEnabled] = useState(() => {
  const saved = localStorage.getItem('soundEnabled');
  return saved !== null ? saved === 'true' : true; // по умолчанию звук включён
});

  useEffect(() => {
  const newSocket = io(import.meta.env.VITE_SERVER_URL || "");
  setSocket(newSocket);

  newSocket.on('room-update', (updatedRoom: Room) => {
    setRoom(updatedRoom);
  });

  newSocket.on('game-started', (updatedRoom: Room) => {
    setRoom(updatedRoom);
    setMarkedNumbers(new Set());
    setWinner(null);
  });

  newSocket.on('new-number', ({ number, drawnNumbers }: { number: number; drawnNumbers: number[] }) => {
    setRoom(prev => prev ? { ...prev, lastNumber: number, drawnNumbers } : null);
    speakNumber(number); // вызов озвучки, если она уже добавлена
  });

  newSocket.on('winner', (data: { username: string; winnerId: string }) => {
    setWinner(data);
    confetti({
      particleCount: 200,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#ef4444', '#f59e0b', '#10b981']
    });
  });

  return () => {
    newSocket.close();
  };
}, []);

  const joinRoom = () => {
    if (username && roomId && socket) {
      socket.emit('join-room', { roomId, username });
      setJoined(true);
    }
  };

  const startGame = () => {
    if (socket && room) {
      socket.emit('start-game', { roomId: room.id, intervalMs: drawInterval });
    }
  };

  const handleMark = (num: number) => {
    // Можно отмечать только те числа, которые уже выпали
    if (!room?.drawnNumbers.includes(num)) return;

    const newMarked = new Set(markedNumbers);
    newMarked.add(num);
    setMarkedNumbers(newMarked);

    if (room) {
      const myPlayer = room.players.find(p => p.id === socket?.id);
      if (myPlayer) {
        myPlayer.cards.forEach((card, idx) => {
          const cardNumbers = card.flat().filter(n => n !== null) as number[];
          const isFullCard = cardNumbers.every(n => newMarked.has(n));
          if (isFullCard) {
            socket?.emit('bingo', { roomId: room.id, cardIdx: idx });
          }
        });
      }
    }
  };
    // Озвучивание чисел
    const speak = (text: string) => {
  console.log("speak called with:", text);
  alert(`Озвучка: ${text}`); // временное всплывающее окно
  if (!soundEnabled) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  window.speechSynthesis.speak(utterance);
};

  if (!joined) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 font-sans overflow-hidden relative">
        {/* Background barrels decoration */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-white font-black text-8xl"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                transform: `rotate(${Math.random() * 360}deg)`
              }}
            >
              {Math.floor(Math.random() * 90) + 1}
            </div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-stone-800 p-8 rounded-[2.5rem] shadow-2xl border border-stone-700 w-full max-w-md relative z-10"
        >
          <div className="flex justify-center mb-6">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="w-24 h-24 bg-red-600 rounded-3xl flex items-center justify-center shadow-xl"
            >
              <Hash className="text-white w-14 h-14" />
            </motion.div>
          </div>
          <h1 className="text-4xl font-black text-white text-center mb-2 uppercase tracking-tighter">Русское Лото</h1>
          <p className="text-stone-400 text-center mb-8 text-sm font-medium">Классическая игра в новом облике</p>

          <div className="space-y-5">
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-stone-700/50 border-2 border-stone-600 rounded-2xl p-5 text-white placeholder-stone-500 focus:border-red-500 focus:ring-0 transition-all outline-none text-lg font-bold"
                placeholder="Ваше имя"
              />
            </div>
            <div className="relative">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full bg-stone-700/50 border-2 border-stone-600 rounded-2xl p-5 text-white placeholder-stone-500 focus:border-red-500 focus:ring-0 transition-all outline-none text-lg font-bold"
                placeholder="ID Комнаты"
              />
            </div>
            <button
              onClick={joinRoom}
              disabled={!username || !roomId}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-5 rounded-2xl shadow-xl shadow-red-900/40 transition-all flex items-center justify-center gap-3 text-xl active:scale-95"
            >
              ИГРАТЬ <Play className="w-6 h-6 fill-current" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const myPlayer = room?.players.find(p => p.id === socket?.id);

  return (
    <div className="min-h-screen bg-[#e8e4d9] text-stone-900 font-sans selection:bg-red-200">
      {/* Header */}
      <header className="bg-stone-900 text-white p-5 shadow-2xl flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-red-600 p-2.5 rounded-xl shadow-lg shadow-red-900/40">
            <Hash className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter leading-none">ЛОТО</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] bg-stone-700 px-2 py-0.5 rounded text-stone-300 uppercase font-black">ID: {roomId}</span>
              <span className="text-[10px] bg-emerald-900 text-emerald-400 px-2 py-0.5 rounded uppercase font-black">Online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 hover:bg-stone-800 rounded-2xl transition-all text-stone-400 hover:text-white"
          >
            <Settings2 className="w-6 h-6" />
          </button>
          <button
            onClick={() => window.location.reload()}
            className="p-3 hover:bg-red-900/30 rounded-2xl transition-all text-stone-400 hover:text-red-400"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-10">
        {room?.status === 'waiting' && (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] shadow-2xl border-4 border-stone-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-red-600" />
            <Users className="w-20 h-20 text-stone-200 mb-6" />
            <h2 className="text-4xl font-black text-stone-800 mb-3 uppercase italic">Зал ожидания</h2>
            <p className="text-stone-500 mb-10 font-medium">Игроки собираются в комнате <span className="text-red-600 font-black">{roomId}</span></p>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {room.players.map(p => (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  key={p.id}
                  className="flex items-center gap-3 bg-stone-100 px-6 py-3 rounded-2xl border-2 border-stone-200 shadow-sm"
                >
                  <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <span className="font-black text-lg">{p.username} {p.id === socket?.id && '⭐️'}</span>
                </motion.div>
              ))}
            </div>

            {room.players[0]?.id === socket?.id && (
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={startGame}
                  className="bg-red-600 hover:bg-red-500 text-white font-black px-16 py-5 rounded-2xl shadow-2xl shadow-red-900/30 transition-all flex items-center gap-4 text-2xl active:scale-95"
                >
                  НАЧАТЬ ТИРАЖ <Play className="w-6 h-6 fill-current" />
                </button>
                <div className="flex items-center gap-2 text-stone-400 text-sm font-bold">
                  <Timer className="w-4 h-4" /> Интервал: {drawInterval / 1000} сек
                </div>
              </div>
            )}
          </div>
        )}

        {room?.status === 'playing' && (
          <div className="space-y-12">
            {/* Small Keg in corner */}
            {room.lastNumber && (
              <div className="fixed bottom-4 right-4 z-50 bg-red-600 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                <span className="text-white font-black text-2xl">{room.lastNumber}</span>
              </div>
            )}

            {/* Drawn numbers list */}
            <div className="mt-8 flex flex-col items-center">
              <h3 className="text-stone-400 font-black uppercase tracking-[0.3em] text-sm mb-4">Выпавшие номера</h3>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
                {room.drawnNumbers.slice(-10).reverse().map((n, i) => (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    key={n}
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-md ${i === 0 ? 'bg-red-600 text-white scale-110' : 'bg-white text-stone-400'}`}
                  >
                    {n}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Game Board */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
              {/* Left: Player List */}
              <div className="xl:col-span-3 space-y-4">
                <h3 className="font-black uppercase text-stone-400 tracking-widest text-xs flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4" /> Участники тиража
                </h3>
                {room.players.map(p => (
                  <div key={p.id} className={`p-4 rounded-2xl border-2 transition-all ${p.id === socket?.id ? 'bg-white border-red-500 shadow-xl' : 'bg-stone-100 border-stone-200'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-black text-lg truncate max-w-[150px]">{p.username}</span>
                      <div className="flex gap-1">
                        {Array(3).fill(0).map((_, i) => (
                          <div key={i} className="w-2.5 h-2.5 rounded-full bg-red-600/20" />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right: My Cards */}
              <div className="xl:col-span-9 space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black uppercase flex items-center gap-3 italic">
                    <LayoutGrid className="w-8 h-8 text-red-600" /> Ваши игровые билеты
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-8">
                  {myPlayer?.cards.map((card, idx) => (
                    <LottoCard
                      key={idx}
                      card={card}
                      drawnNumbers={room.drawnNumbers}
                      onMark={handleMark}
                      marked={markedNumbers}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {winner && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 z-[100] bg-stone-900/90 backdrop-blur-md flex items-center justify-center p-4"
  >
    <motion.div
      initial={{ scale: 0.5, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      className="bg-white p-12 rounded-[4rem] shadow-2xl text-center max-w-md w-full border-[12px] border-amber-400 relative"
    >
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-32 h-32 bg-amber-400 rounded-full flex items-center justify-center shadow-2xl">
        <Trophy className="w-16 h-16 text-white" />
      </div>
      <div className="mt-8">
        {socket?.id === winner.winnerId ? (
          <>
            <h2 className="text-5xl font-black text-stone-900 mb-4 uppercase italic tracking-tighter">БИНГО!</h2>
            <p className="text-stone-500 text-xl mb-10 font-medium">Вы выиграли!</p>
          </>
        ) : (
          <>
            <h2 className="text-5xl font-black text-stone-900 mb-4 uppercase italic tracking-tighter">БИНГО!</h2>
            <p className="text-stone-500 text-xl mb-10 font-medium">
              Победитель тиража: <br />
              <span className="text-3xl font-black text-red-600 block mt-2">{winner.username}</span>
            </p>
          </>
        )}
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-stone-900 text-white font-black py-5 rounded-3xl hover:bg-stone-800 transition-all text-xl shadow-xl active:scale-95"
        >
          НОВЫЙ ТИРАЖ
        </button>
      </div>
    </motion.div>
  </motion.div>
)}
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-stone-800 p-8 rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-stone-700"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-white uppercase italic">Настройки</h3>
                <button onClick={() => setShowSettings(false)} className="text-stone-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-stone-400 font-bold uppercase text-xs tracking-widest">Скорость тиража</label>
                    <span className="text-red-500 font-black">{drawInterval / 1000} сек</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="10000"
                    step="500"
                    value={drawInterval}
                    onChange={(e) => setDrawInterval(parseInt(e.target.value))}
                    className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-red-600"
                  />
                  <div className="flex justify-between mt-2 text-[10px] font-black text-stone-600 uppercase">
                    <span>Быстро</span>
                    <span>Медленно</span>
                  </div>
                </div>
				
				<div className="flex justify-between items-center">
  <label className="text-stone-400 font-bold uppercase text-xs tracking-widest">Звук</label>
  <button
    onClick={() => setSoundEnabled(!soundEnabled)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${soundEnabled ? 'bg-red-600' : 'bg-stone-600'}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'}`}
    />
  </button>
</div>

                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-white text-stone-900 font-black py-4 rounded-2xl hover:bg-stone-100 transition-all"
                >
                  СОХРАНИТЬ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="p-10 text-center">
        <div className="inline-flex items-center gap-2 px-6 py-2 bg-stone-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-xl">
          Русское Лото Онлайн <div className="w-1 h-1 bg-red-600 rounded-full" /> 2026
        </div>
      </footer>
    </div>
  );
}