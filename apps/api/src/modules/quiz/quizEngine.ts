export interface StoredQuestion {
  q: string
  options: string[]
  answer: number  // index into options
}

export interface QuizScore {
  score: number        // 0-100 integer, floor
  correctCount: number
  totalQuestions: number
}

export function scoreQuiz(questions: StoredQuestion[], answers: number[]): QuizScore {
  const totalQuestions = questions.length
  let correctCount = 0
  for (let i = 0; i < totalQuestions; i++) {
    if (answers[i] === questions[i].answer) correctCount++
  }
  return {
    score: totalQuestions === 0 ? 0 : Math.floor((correctCount / totalQuestions) * 100),
    correctCount,
    totalQuestions,
  }
}

export interface QuizReviewItem {
  question: string
  options: string[]
  selectedIndex: number
  correctIndex: number
  isCorrect: boolean
}

export function buildQuizReview(questions: StoredQuestion[], answers: number[]): QuizReviewItem[] {
  return questions.map((question, i) => ({
    question: question.q,
    options: question.options,
    selectedIndex: answers[i] ?? -1,
    correctIndex: question.answer,
    isCorrect: answers[i] === question.answer,
  }))
}

/** Deterministic Fisher-Yates shuffle using a string seed (xorshift32). */
export function selectDailyQuestions(pool: StoredQuestion[], count: number, seed: string): StoredQuestion[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  function next(): number {
    h ^= h << 13
    h ^= h >> 17
    h ^= h << 5
    return (h >>> 0) / 0x100000000
  }
  const arr = [...pool]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, Math.min(count, arr.length))
}
