/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCw, 
  Gamepad2, 
  Edit3,
  CheckCircle,
  XCircle as XIcon,
  BookOpen,
  ArrowRight,
  Search,
  ChevronLeft,
  Loader2,
  Zap,
  Sparkles
} from 'lucide-react';
import { SYNONYM_DATA, Level } from './data/synonyms';
import { puzzleService, PuzzleModel, PuzzleGroup } from './services/puzzleService';

type GameMode = '10_QUESTIONS' | 'PUZZLE';
type Screen = 'MENU' | 'PLAYING' | 'SUMMARY' | 'SEARCH' | 'PUZZLE_GROUPS' | 'PUZZLE';

interface Question {
  word: string;
  correctAnswer: string;
  options: string[];
}

interface Result {
  word: string;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
}

const RESULT_MESSAGES = [
  { 
    threshold: 0.9, 
    emoji: "👑", 
    message: "Zu zara hemen nagusia! Sinonimoen erregea/erregina zara!" 
  },
  { 
    threshold: 0.75, 
    emoji: "😎", 
    message: "Oso ondo! Ia-ia hiztegiaren jabe osoa zara." 
  },
  { 
    threshold: 0.6, 
    emoji: "📈", 
    message: "Ez dago gaizki, bide onetik zoaz! Jarraitu trebatzen." 
  },
  { 
    threshold: 0.45, 
    emoji: "😂", 
    message: "Hiztegia konpontzen ari zara, edota barrez lehertzen nago zure akatsekin!" 
  },
  { 
    threshold: 0.3, 
    emoji: "📚", 
    message: "Ez dago gaizki, baina hiztegia pixka bat gehiago ireki beharko zenuke... 😉" 
  },
  { 
    threshold: 0.15, 
    emoji: "🙈", 
    message: "Eskerrak hiztegiari galdetzeko aukera duzun... berriro saiatu gaitezen?" 
  },
  { 
    threshold: 0, 
    emoji: "😅", 
    message: "Ba... seguru zaude hitz hauek euskara direla? Berriro saiatu, baina mesedez, begiratu hiztegia!" 
  }
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('MENU');
  const [mode, setMode] = useState<GameMode>('10_QUESTIONS');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState<Level>('B2');
  const [puzzleHistory, setPuzzleHistory] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Puzzle State
  const [selectedPuzzleLevel, setSelectedPuzzleLevel] = useState<1 | 2>(1);
  const [puzzleLevels, setPuzzleLevels] = useState<PuzzleModel[]>([]);
  const [currentPuzzleIdx, setCurrentPuzzleIdx] = useState(0);
  const [puzzleStatus, setPuzzleStatus] = useState<'IDLE' | 'CORRECT' | 'WRONG'>('IDLE');
  const [showPuzzleOptions, setShowPuzzleOptions] = useState(false);
  const [activeTargetIdx, setActiveTargetIdx] = useState<number | null>(null);
  const [solvedTargets, setSolvedTargets] = useState<number[]>([]);

  // Persistence (History) - Shared Preferences alternative in Web
  useEffect(() => {
    const history = localStorage.getItem('puzzle_history');
    if (!history) {
      localStorage.setItem('puzzle_history', JSON.stringify([]));
      setPuzzleHistory([]);
    } else {
      setPuzzleHistory(JSON.parse(history));
    }
  }, []);

  const saveToHistory = (levelId: string) => {
    const history = JSON.parse(localStorage.getItem('puzzle_history') || '[]');
    if (!history.includes(levelId)) {
      history.push(levelId);
      localStorage.setItem('puzzle_history', JSON.stringify(history));
      setPuzzleHistory(history);
    }
  };

  const generateQuestion = useCallback((targetLevel: Level, pastWords: string[] = []) => {
    // Find which groups have already been used to prevent repeating concepts
    const pastGroupIds = SYNONYM_DATA
      .filter(g => g.words.some(w => pastWords.includes(w)))
      .map(g => g.id);

    let levelData = SYNONYM_DATA.filter(g => g.level === targetLevel && !pastGroupIds.includes(g.id));
    if (levelData.length === 0) {
      // Fallback if we run out of fresh groups
      levelData = SYNONYM_DATA.filter(g => g.level === targetLevel);
    }
    
    const groupIndex = Math.floor(Math.random() * levelData.length);
    const group = levelData[groupIndex];
    
    const wordIndex = Math.floor(Math.random() * group.words.length);
    const word = group.words[wordIndex];
    
    const synonymOptions = group.words.filter(w => w !== word);
    const correctAnswer = synonymOptions[Math.floor(Math.random() * synonymOptions.length)];

    const distractors: string[] = [];
    const wordsInTarget = new Set<string>();
    group.words.forEach(w => wordsInTarget.add(w));
    
    // Past words handling is already preventing concept repetition
    // Now ensure even within the current question, options don't repeat
    const usedWords = new Set<string>();
    usedWords.add(word);
    group.words.forEach(w => usedWords.add(w)); // All words in the synonym group
    while (distractors.length < 3) {
      const randomGroup = SYNONYM_DATA[Math.floor(Math.random() * SYNONYM_DATA.length)];
      if (randomGroup.id !== group.id) {
        const randomWord = randomGroup.words[Math.floor(Math.random() * randomGroup.words.length)];
        if (!usedWords.has(randomWord)) {
          distractors.push(randomWord);
          usedWords.add(randomWord);
        }
      }
    }

    const options = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);

    return { word, correctAnswer, options };
  }, []);

  const startGame = (selectedLevel: Level) => {
    setMode('10_QUESTIONS');
    setLevel(selectedLevel);
    setIsLoading(true);
    setScreen('PLAYING');
    setQuestionCount(0);
    setScore(0);
    setResults([]);
    setSelectedAnswer(null);
    setIsRevealed(false);
    
    setTimeout(() => {
      setCurrentQuestion(generateQuestion(selectedLevel, []));
      setIsLoading(false);
    }, 600);
  };

  const handleAnswer = (answer: string) => {
    if (!currentQuestion || isRevealed) return;

    const isCorrect = answer === currentQuestion.correctAnswer;
    setIsRevealed(true);
    setSelectedAnswer(answer);

    const newResult: Result = {
      word: currentQuestion.word,
      correctAnswer: currentQuestion.correctAnswer,
      userAnswer: answer,
      isCorrect
    };

    setResults(prev => [...prev, newResult]);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
  };

  const goToPuzzleLevels = () => {
    setScreen('PUZZLE_GROUPS');
  };

  const selectPuzzleLevel = (lvl: 1 | 2) => {
    setSelectedPuzzleLevel(lvl);
    setScreen('PUZZLE_GROUPS');
  };

  const selectPuzzleGroup = (groupPuzzles: PuzzleModel[]) => {
    setMode('PUZZLE');
    setPuzzleLevels(groupPuzzles);
    setCurrentPuzzleIdx(0);
    setPuzzleStatus('IDLE');
    setSolvedTargets([]);
    setActiveTargetIdx(null);
    setScore(0);
    setResults([]);
    setScreen('PUZZLE');
  };

  const openPuzzleOptions = (targetIdx: number) => {
    if (solvedTargets.includes(targetIdx) || puzzleStatus !== 'IDLE') return;
    setActiveTargetIdx(targetIdx);
    setShowPuzzleOptions(true);
  };

  const handlePuzzleAnswer = (option: string) => {
    if (activeTargetIdx === null) return;
    
    const currentPuzzle = puzzleLevels[currentPuzzleIdx];
    const target = currentPuzzle.targets[activeTargetIdx];
    const isCorrect = option === target.zuzena;
    
    // Record result for summary
    const puzzleResult: Result = {
      word: target.klabea,
      correctAnswer: target.zuzena,
      userAnswer: option,
      isCorrect
    };
    setResults(prev => [...prev, puzzleResult]);
    
    if (isCorrect) {
      setPuzzleStatus('CORRECT');
      setSolvedTargets(prev => [...prev, activeTargetIdx]);
      setScore(prev => prev + 1);
    } else {
      setPuzzleStatus('WRONG');
      // Even if wrong, we treat it as "attempted" so user can see it in summary
      // In this specific mode, we'll let them see the error and move on
      setSolvedTargets(prev => [...prev, activeTargetIdx]);
    }
    
    setShowPuzzleOptions(false);

    setTimeout(() => {
      setPuzzleStatus('IDLE');
      setActiveTargetIdx(null);
      
      const isPuzzleSolved = (solvedTargets.length + 1) === currentPuzzle.targets.length;
      
      if (isPuzzleSolved) {
        saveToHistory(currentPuzzle.id);
        if (currentPuzzleIdx < puzzleLevels.length - 1) {
          setCurrentPuzzleIdx(prev => prev + 1);
          setSolvedTargets([]);
        } else {
          setScreen('SUMMARY');
        }
      }
    }, 1200);
  };

  const goToNextQuestion = () => {
    const nextCount = questionCount + 1;
    setQuestionCount(nextCount);
    setSelectedAnswer(null);
    setIsRevealed(false);
    setIsLoading(true);

    setTimeout(() => {
      if (nextCount >= 10) {
        setScreen('SUMMARY');
        setIsLoading(false);
      } else {
        // Collect words asked so far from results array
        setCurrentQuestion(generateQuestion(level, results.map(r => r.word)));
        setIsLoading(false);
      }
    }, 500);
  };

  const getFinalFeedback = () => {
    const totalQuestions = mode === 'PUZZLE' 
      ? puzzleLevels.reduce((acc, p) => acc + p.targets.length, 0)
      : 10;
    const ratio = score / totalQuestions;
    return RESULT_MESSAGES.find(m => ratio >= m.threshold) || RESULT_MESSAGES[RESULT_MESSAGES.length - 1];
  };

  const filteredSynonyms = searchQuery.trim() === '' 
    ? SYNONYM_DATA.slice(0, 15) // Show first 15 by default
    : SYNONYM_DATA.filter(group => 
        group.words.some(word => word.toLowerCase().includes(searchQuery.toLowerCase()))
      );

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans selection:bg-blue-100 flex items-center justify-center py-4 md:py-8">
      <div className="w-full max-w-[1024px] px-4">
        <AnimatePresence mode="wait">
          {screen === 'MENU' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="text-center space-y-12 py-12"
            >
              <div className="space-y-6">
                <div className="text-[11px] md:text-xs font-black text-brand-primary tracking-[0.3em] uppercase">
                  Euskaraz Ikasten Lab
                </div>
                
                <div className="space-y-1">
                  <h1 className="text-6xl md:text-8xl font-black tracking-[-0.04em] text-[#0f172a] leading-none uppercase">
                    Zinok
                  </h1>
                </div>

                <div className="flex justify-center pt-4">
                  <div className="w-24 md:w-32 h-2 md:h-3 bg-[#0f172a]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto px-4 pt-8">
                <button
                  onClick={() => startGame('B2')}
                  className="group sleek-card-interactive p-4 md:p-10 flex flex-col items-center justify-center min-h-[160px] md:min-h-[300px]"
                >
                  <div className="text-brand-accent mb-4 md:mb-8 p-3 md:p-4 bg-purple-50 rounded-full border-2 border-brand-accent/20 group-hover:bg-brand-accent group-hover:text-white transition-all duration-300">
                    <Zap size={24} className="md:w-12 md:h-12" />
                  </div>
                  <h3 className="text-lg md:text-4xl font-black text-slate-900 uppercase tracking-tighter mb-1">1. MAILA</h3>
                  <p className="text-slate-400 font-bold uppercase text-[8px] md:text-xs tracking-wider">B2 mailako erronka</p>
                </button>

                <button
                  onClick={() => startGame('C1')}
                  className="group sleek-card-interactive p-4 md:p-10 flex flex-col items-center justify-center min-h-[160px] md:min-h-[300px]"
                >
                  <div className="text-brand-secondary mb-4 md:mb-8 p-3 md:p-4 bg-amber-50 rounded-full border-2 border-brand-secondary/20 group-hover:bg-brand-secondary group-hover:text-white transition-all duration-300">
                    <Sparkles size={24} className="md:w-12 md:h-12" />
                  </div>
                  <h3 className="text-lg md:text-4xl font-black text-slate-900 uppercase tracking-tighter mb-1">2. MAILA</h3>
                  <p className="text-slate-400 font-bold uppercase text-[8px] md:text-xs tracking-wider">C1 mailako erronka</p>
                </button>

                <button
                  onClick={goToPuzzleLevels}
                  className="col-span-2 group sleek-card-interactive p-4 md:p-10 flex flex-col items-center justify-center min-h-[120px] md:min-h-[200px] border-dashed border-2 bg-slate-50/50"
                >
                  <div className="flex items-center gap-3 md:gap-6">
                    <div className="text-brand-primary p-3 md:p-4 bg-blue-50 rounded-full border-2 border-brand-primary/20 group-hover:bg-brand-primary group-hover:text-white transition-all duration-300 shadow-xl">
                      <Edit3 size={24} className="md:w-10 md:h-10" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter">MEZU ZUZENTZAILEA</h3>
                      <p className="text-slate-400 font-bold uppercase text-[8px] md:text-xs tracking-wider">Editorearentzako erronka berezia</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex justify-center pt-8">
                <button
                  onClick={() => setScreen('SEARCH')}
                  className="group flex items-center gap-4 px-6 py-4 md:px-10 md:py-5 bg-white border-[3px] border-brand-border text-slate-900 font-black uppercase tracking-widest hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-all active:scale-95 shadow-[6px_6px_0px_0px_#0f172a] hover:shadow-[2px_2px_0px_0px_#0f172a] hover:translate-x-[4px] hover:translate-y-[4px]"
                >
                  <Search size={22} />
                  Hiztegia arakatu
                </button>
              </div>
            </motion.div>
          )}

          {screen === 'PUZZLE_GROUPS' && (
            <motion.div
              key="puzzle-groups"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-5xl mx-auto w-full px-4"
            >
              <div className="sleek-card p-6 md:p-12 space-y-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-4 border-brand-border pb-8">
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-brand-primary text-white border-2 border-brand-border shadow-[4px_4px_0px_0px_#0f172a]">
                      <Edit3 size={32} />
                    </div>
                    <div>
                      <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter">
                        Mezu Zuzentzailea
                      </h2>
                      <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-1">Hautatu sorta aurrera egiteko</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setScreen('MENU')}
                    className="text-slate-400 hover:text-brand-primary font-black uppercase text-[10px] tracking-widest flex items-center gap-2 border-2 border-slate-100 px-4 py-2 hover:border-brand-primary transition-all"
                  >
                    Menu Nagusia
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-6">
                  {[...puzzleService.getGroups(1), ...puzzleService.getGroups(2)].map((group, idx) => {
                    const completedCount = group.puzzles.filter(p => puzzleHistory.includes(p.id)).length;
                    const isFullyCompleted = completedCount === group.puzzles.length;
                    
                    return (
                      <button
                        key={`${group.id}-${idx}`}
                        onClick={() => selectPuzzleGroup(group.puzzles)}
                        className={`group sleek-card-interactive opacity-100 p-4 md:p-6 flex flex-col items-center justify-center text-center ${
                          isFullyCompleted ? 'bg-emerald-50 border-emerald-500' : ''
                        }`}
                      >
                        <div className="w-full flex justify-end items-start mb-1 h-4">
                          {isFullyCompleted && <CheckCircle size={16} className="text-emerald-500" />}
                        </div>
                        <h4 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tighter">
                          {idx + 1}. SORTA
                        </h4>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => setScreen('MENU')}
                    className="text-slate-400 hover:text-brand-primary font-black uppercase text-xs tracking-widest flex items-center gap-2 transition-colors"
                  >
                    <ChevronLeft size={16} />
                    Atzera
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {screen === 'PUZZLE' && puzzleLevels[currentPuzzleIdx] && (
            <motion.div
              key="puzzle"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto w-full px-4"
            >
              <div className="sleek-card flex flex-col overflow-hidden relative min-h-[550px]">
                {/* Header Info */}
                <div className="px-6 md:px-10 py-4 bg-slate-50 border-b-2 border-brand-border flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="bg-brand-primary text-white text-[10px] font-black px-3 py-1 uppercase tracking-tighter">
                      {selectedPuzzleLevel}. MAILA
                    </span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {currentPuzzleIdx + 1}/{puzzleLevels.length} ERRONKA
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-brand-primary">
                    <Zap size={16} className="fill-current" />
                    <span className="font-black text-base italic">{score}</span>
                  </div>
                </div>

                <div className="p-6 md:p-16 flex flex-col items-center justify-center flex-grow space-y-8 md:space-y-16 relative overflow-hidden bg-white">
                  {/* Feedback Stamps */}
                  <AnimatePresence>
                    {puzzleStatus === 'CORRECT' && (
                      <motion.div
                        initial={{ scale: 3, opacity: 0, rotate: -20 }}
                        animate={{ scale: 1, opacity: 1, rotate: -15 }}
                        className="absolute z-50 pointer-events-none border-[6px] md:border-[10px] border-emerald-500 text-emerald-500 px-6 py-4 md:px-10 md:py-6 font-black text-4xl md:text-8xl uppercase tracking-tighter transform bg-white/60 backdrop-blur-md shadow-[6px_6px_0px_0px_rgba(16,185,129,0.2)] md:shadow-[10px_10px_0px_0px_rgba(16,185,129,0.2)]"
                      >
                        ZUZENA
                      </motion.div>
                    )}
                    {puzzleStatus === 'WRONG' && (
                      <motion.div
                        initial={{ scale: 3, opacity: 0, rotate: 20 }}
                        animate={{ scale: 1, opacity: 1, rotate: 15 }}
                        className="absolute z-50 pointer-events-none border-[6px] md:border-[10px] border-rose-500 text-rose-500 px-6 py-4 md:px-10 md:py-6 font-black text-4xl md:text-8xl uppercase tracking-tighter transform bg-white/60 backdrop-blur-md shadow-[6px_6px_0px_0px_rgba(244,63,94,0.2)] md:shadow-[10px_10px_0px_0px_rgba(244,63,94,0.2)]"
                      >
                        OKERRA
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="w-full space-y-8 text-center max-w-3xl">
                    <div className="flex justify-center">
                      <div className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] px-4 py-2 italic border-b-4 border-brand-primary">
                        EDITOREA - TESTUA ZUZENDU
                      </div>
                    </div>
                    
                    <div className="text-2xl md:text-4xl lg:text-5xl font-black leading-[1.4] md:leading-[1.6] text-slate-800 tracking-tight">
                      {puzzleLevels[currentPuzzleIdx].esaldia.split(' ').map((word, i) => {
                        const cleanWordForMatch = word.replace(/[.,:;]/g, '').toLowerCase();
                        
                        const targetIdx = puzzleLevels[currentPuzzleIdx].targets.findIndex(
                          t => t.klabea.toLowerCase() === cleanWordForMatch
                        );
                        
                        const isTarget = targetIdx !== -1;
                        const isSolved = isTarget && solvedTargets.includes(targetIdx);
                        const isActive = isTarget && activeTargetIdx === targetIdx;
                        
                        return (
                          <span key={i} className="inline-block mr-2 mb-2">
                            {isTarget ? (
                              <button
                                onClick={() => openPuzzleOptions(targetIdx)}
                                className={`px-2 py-1 transition-all duration-300 relative ${
                                  isSolved 
                                    ? 'bg-emerald-100 text-emerald-700 border-b-4 border-emerald-500 cursor-default' 
                                    : isActive
                                      ? 'bg-blue-600 text-white border-b-4 border-slate-900'
                                      : 'bg-blue-50 text-brand-primary border-b-4 border-brand-primary hover:bg-brand-primary hover:text-white'
                                }`}
                              >
                                {word}
                                {!isSolved && (
                                  <div className="absolute -top-6 -right-3">
                                    <div className="w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center text-[10px] text-white shadow-md border-2 border-white">
                                      {targetIdx + 1}
                                    </div>
                                  </div>
                                )}
                              </button>
                            ) : (
                              <span className="opacity-100 transition-opacity">{word}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Options Modal */}
                  <AnimatePresence>
                    {showPuzzleOptions && activeTargetIdx !== null && (
                      <>
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setShowPuzzleOptions(false)}
                          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-30 flex items-center justify-center p-6"
                        />
                        <motion.div
                          initial={{ y: 100, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: 100, opacity: 0 }}
                          className="absolute bottom-0 left-0 right-0 md:relative md:inset-auto bg-white border-[4px] border-brand-border p-5 md:p-8 z-40 max-w-xl w-full shadow-[12px_12px_0px_0px_#0f172a]"
                        >
                          <div className="mb-8 text-center">
                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Aukeratu sinonimoa</h5>
                            <div className="text-2xl font-black text-brand-primary italic uppercase tracking-tighter">
                              {puzzleLevels[currentPuzzleIdx].targets[activeTargetIdx].klabea}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              puzzleLevels[currentPuzzleIdx].targets[activeTargetIdx].zuzena,
                              ...puzzleLevels[currentPuzzleIdx].targets[activeTargetIdx].distraktoreak
                            ].sort(() => Math.random() - 0.5).map((option, i) => (
                              <button
                                key={i}
                                onClick={() => handlePuzzleAnswer(option)}
                                className="sleek-btn-secondary py-4 text-xs md:text-sm hover:bg-slate-50 border-2"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                          
                          <button
                            onClick={() => setShowPuzzleOptions(false)}
                            className="w-full mt-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors"
                          >
                            Utzi
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <div className="p-8 md:p-12 bg-slate-50 border-t-2 border-brand-border flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] max-w-md">
                      <span>
                        {puzzleLevels[currentPuzzleIdx].targets.length === 1 
                          ? "Sakatu urdinez dagoen hitza bere sinonimoa topatzeko." 
                          : "Maila honetan bi hitz zuzendu behar dituzu aurrera egiteko."}
                      </span>
                    </div>
                    <button
                      onClick={() => setScreen('PUZZLE_GROUPS')}
                      className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-brand-primary flex items-center justify-center gap-2"
                    >
                      Utzi erronka
                    </button>
                </div>
              </div>
            </motion.div>
          )}

          {screen === 'PLAYING' && currentQuestion && (
            <motion.div
              key="playing-container"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-[700px] mx-auto w-full"
            >
              <div className="sleek-card flex flex-col overflow-hidden relative min-h-[500px] md:min-h-[600px]">
                {/* Progress Bar (TOP) */}
                <div className="w-full h-2 bg-slate-100 absolute top-0 left-0 z-20">
                  <motion.div 
                    className="h-full bg-brand-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(questionCount / 10) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {/* Header */}
                <div className="px-6 md:px-8 py-4 md:py-6 border-b border-brand-border flex items-center justify-between bg-white z-10">
                  <div className="flex items-center gap-2">
                    <div className="font-extrabold text-xl md:text-2xl text-brand-primary italic uppercase tracking-tighter">Zinok</div>
                    <span className="text-[10px] font-black bg-[#0f172a] text-white px-2 py-0.5 rounded-none border border-[#0f172a]">
                      {level}
                    </span>
                  </div>
                  <div className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">
                    Galdera {questionCount + 1}/10
                  </div>
                </div>

                <div className="flex-grow flex flex-col items-center justify-center p-6 md:p-12 text-center space-y-6 md:space-y-12">
                  {isLoading ? (
                    <div className="w-full space-y-12">
                      <div className="space-y-4 flex flex-col items-center">
                        <div className="skeleton h-6 w-32"></div>
                        <div className="skeleton h-20 md:h-24 w-64 md:w-96"></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mx-auto">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="skeleton h-16 md:h-20 w-full rounded-2xl"></div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 md:space-y-4">
                        <h2 className="text-4xl md:text-6xl lg:text-7xl font-black text-slate-900 uppercase leading-none px-4 break-words">
                          {currentQuestion.word}
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 w-full max-w-2xl px-2">
                        {currentQuestion.options.map((option) => {
                          const isCorrect = option === currentQuestion.correctAnswer;
                          const isSelected = option === selectedAnswer;
                          
                          let buttonClass = "bg-slate-50 text-slate-700 hover:bg-white hover:shadow-lg hover:shadow-blue-100 border-brand-border";
                          
                          if (isRevealed) {
                            if (isCorrect) {
                              buttonClass = "bg-emerald-500 text-white border-emerald-600 shadow-[4px_4px_0px_0px_#059669] translate-x-[-2px] translate-y-[-2px]";
                            } else if (isSelected) {
                              buttonClass = "bg-rose-500 text-white border-rose-600 shadow-[4px_4px_0px_0px_#e11d48] translate-x-[-2px] translate-y-[-2px]";
                            } else {
                              buttonClass = "bg-slate-50 text-slate-300 opacity-40 grayscale-[0.5] border-slate-200";
                            }
                          }

                          return (
                            <motion.div
                              key={option}
                              initial={false}
                              animate={isRevealed && isSelected && !isCorrect ? { 
                                x: [0, -4, 4, -4, 4, 0],
                              } : {}}
                              transition={{ duration: 0.4 }}
                              className="w-full"
                            >
                              <button
                                disabled={isRevealed}
                                onClick={() => handleAnswer(option)}
                                className={`sleek-btn-option w-full flex items-center justify-between px-6 py-4 md:py-5 ${buttonClass}`}
                              >
                                <span className="flex-grow text-center">{option}</span>
                                <AnimatePresence>
                                  {isRevealed && isCorrect && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                      className="shrink-0 ml-2"
                                    >
                                      <CheckCircle size={22} className="text-white" />
                                    </motion.div>
                                  )}
                                  {isRevealed && isSelected && !isCorrect && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.5, rotate: 45 }}
                                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                      className="shrink-0 ml-2"
                                    >
                                      <XIcon size={22} className="text-white" />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>

                      {isRevealed && !isLoading && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="pt-4 w-full max-w-md mx-auto"
                        >
                          <button
                            onClick={goToNextQuestion}
                            className="sleek-btn-primary w-full py-5 text-xl group"
                          >
                            Hurrengoa
                            <ArrowRight className="group-hover:translate-x-1 transition-transform duration-300" />
                          </button>
                        </motion.div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="text-center mt-6">
                <button 
                  onClick={() => setScreen('MENU')}
                  className="text-slate-400 hover:text-rose-500 text-sm font-bold transition-colors"
                >
                  Irten partidatik
                </button>
              </div>
            </motion.div>
          )}

          {screen === 'SEARCH' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-2xl mx-auto w-full"
            >
              <div className="sleek-card flex flex-col overflow-hidden min-h-[600px]">
                <div className="px-6 md:px-8 py-4 md:py-6 border-b border-brand-border flex items-center gap-4 bg-white z-10">
                  <button 
                    onClick={() => setScreen('MENU')}
                    className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-brand-primary transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <div className="font-extrabold text-xl md:text-2xl text-brand-primary italic uppercase tracking-tighter">Zinok</div>
                  <div className="flex-grow"></div>
                  <div className="text-[10px] md:text-xs font-black text-white bg-[#0f172a] uppercase tracking-widest px-3 py-1 rounded-none">Hiztegia</div>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors" size={20} />
                    <input
                      type="text"
                      placeholder="Bilatu hitz bat..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-6 py-5 bg-white border-[3px] border-brand-border focus:border-brand-primary focus:bg-white rounded-none outline-none text-slate-900 font-extrabold uppercase placeholder:text-slate-300 shadow-[6px_6px_0px_0px_#0f172a] transition-all"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 scrollbar-hide">
                    {filteredSynonyms.length > 0 ? (
                      filteredSynonyms.map((group) => (
                        <div key={group.id} className="p-5 rounded-none bg-white border-[3px] border-brand-border hover:border-brand-primary transition-all group shadow-[4px_4px_0px_0px_#0f172a] hover:shadow-[2px_2px_0px_0px_#0f172a] hover:translate-x-[2px] hover:translate-y-[2px]">
                          <div className="flex flex-wrap gap-2 items-center">
                            {group.words.map((word, idx) => (
                              <div key={word} className="flex items-center gap-2">
                                <span className={`text-sm md:text-base font-black tracking-tight uppercase ${
                                  searchQuery && word.toLowerCase().includes(searchQuery.toLowerCase())
                                    ? 'text-brand-primary'
                                    : 'text-slate-700'
                                }`}>
                                  {word}
                                </span>
                                {idx < group.words.length - 1 && (
                                  <span className="text-slate-300 font-bold">=</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center space-y-4 text-slate-300 font-medium italic">
                        <Search size={48} className="mx-auto opacity-20" />
                        <p>Ez da emaitzarik aurkitu "{searchQuery}" hitzarentzat</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {screen === 'SUMMARY' && (
            <motion.div
              key="summary-container"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto w-full"
            >
              <div className="sleek-card flex flex-col overflow-hidden relative">
                {/* Header */}
                <div className="px-6 md:px-8 py-4 md:py-6 border-b border-brand-border flex items-center justify-between bg-white z-10">
                  <div className="font-extrabold text-xl md:text-2xl text-brand-primary italic uppercase tracking-tighter">Zinok</div>
                  <div className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Partida amaitua</div>
                </div>

                <div className="p-6 md:p-10 text-center space-y-8 min-h-[500px] flex flex-col justify-center">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center space-y-4 py-20">
                      <Loader2 size={48} className="text-brand-primary animate-spin" />
                      <p className="text-slate-400 font-bold italic">Emaitzak prestatzen...</p>
                    </div>
                  ) : (
                    <>
                      {/* Results Summary Header */}
                      <div className="space-y-4 animate-in fade-in zoom-in duration-500">
                    <div className="text-6xl md:text-8xl">{getFinalFeedback().emoji}</div>
                    <div className="space-y-2">
                       <h2 className="text-5xl md:text-7xl font-black text-slate-900 leading-none">
                         {score}/{mode === 'PUZZLE' 
                           ? puzzleLevels.reduce((acc, p) => acc + p.targets.length, 0)
                           : 10}
                       </h2>
                       <p className="text-slate-500 text-sm md:text-lg italic font-medium max-w-sm mx-auto leading-relaxed">
                         "{getFinalFeedback().message}"
                       </p>
                    </div>
                  </div>

                  {/* Summary List (Inline) */}
                  <div className="pt-2 space-y-4">
                    <div className="flex items-center gap-2 px-2 border-b border-slate-100 pb-3">
                       <BookOpen size={18} className="text-brand-primary" />
                       <span className="text-sm font-black text-slate-900 uppercase tracking-wider">Laburpena</span>
                       <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase">{results.length} hitz denetara</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-h-[350px] overflow-y-auto pr-2 scrollbar-hide">
                      {[...results].reverse().map((res, i) => (
                        <div key={i} className={`flex flex-col p-5 rounded-none border-[3px] transition-colors shadow-[4px_4px_0px_0px_#0f172a] mb-2 ${
                          res.isCorrect ? 'bg-emerald-50 border-emerald-500' : 'bg-rose-50 border-rose-500'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-black text-slate-900 uppercase text-xs tracking-tight">{res.word}</span>
                            <div className={res.isCorrect ? 'text-emerald-500' : 'text-rose-500'}>
                              {res.isCorrect ? <CheckCircle size={16} /> : <XIcon size={16} />}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 text-[11px] font-bold">
                            <div className="flex gap-2">
                              <span className="text-slate-400">Sinonimoa:</span>
                              <span className={res.isCorrect ? 'text-emerald-600' : 'text-slate-700'}>{res.correctAnswer}</span>
                            </div>
                            {!res.isCorrect && (
                              <div className="flex gap-2">
                                <span className="text-slate-400">Zuk esana:</span>
                                <span className="text-rose-500 uppercase line-through opacity-70 italic">{res.userAnswer}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center pt-6 border-t border-slate-100">
                    <button
                      onClick={() => setScreen('MENU')}
                      className="sleek-btn-secondary px-8 py-4"
                    >
                      Menu nagusia
                    </button>
                    <button
                      onClick={() => {
                        if (mode === 'PUZZLE') {
                          selectPuzzleGroup(puzzleLevels);
                        } else {
                          startGame(level);
                        }
                      }}
                      className="sleek-btn-primary px-8 py-4"
                    >
                      <RefreshCw size={20} />
                      Berriro saiatu
                    </button>
                  </div>
                </>
              )}
            </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
