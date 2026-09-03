import { create } from 'zustand';

let fallbackId = 0;
const nextId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `item-${Date.now()}-${fallbackId++}`;

const useDashboardStore = create((set) => ({
  // 1. Raw State
  quizzes: [
    {
      id: 1,
      name: "Programming Fundamentals",
      code: "IT 101",
      students: 42,
      capacity: 50,
      timeAllotted: 60,
      timeRemaining: "22:53",
      progress: 38,
      status: "live",
      formId: null,
      participants: [
        { id: 1, name: "Leo Fernandez", email: "leo.fernandez@school.edu", studentId: "S-1001", status: "submitted", joinedAt: "9:38 AM", score: 82, timeTaken: "20:11" },
        { id: 2, name: "Mason Torres", email: "mason.torres@school.edu", studentId: "S-1002", status: "in-progress", joinedAt: "9:40 AM", score: null, timeTaken: null },
        { id: 3, name: "Isla Ramos", email: "isla.ramos@school.edu", studentId: "S-1003", status: "joined", joinedAt: "9:41 AM", score: null, timeTaken: null },
      ],
    },
    {
      id: 2,
      name: "Programming Fundamentals",
      code: "IT 101",
      students: 42,
      capacity: 50,
      timeAllotted: 60,
      timeRemaining: "22:53",
      progress: 38,
      status: "live",
      formId: null,
      participants: [
        { id: 1, name: "Grace Villanueva", email: "grace.villanueva@school.edu", studentId: "S-1004", status: "in-progress", joinedAt: "9:45 AM", score: null, timeTaken: null },
        { id: 2, name: "Kai Domingo", email: "kai.domingo@school.edu", studentId: "S-1005", status: "joined", joinedAt: "9:46 AM", score: null, timeTaken: null },
      ],
    },
    {
      id: 3,
      name: "Data Structures",
      code: "IT 102",
      students: 30,
      capacity: 45,
      timeAllotted: 45,
      timeRemaining: "10:12",
      progress: 78,
      status: "live",
      formId: 1,
      participants: [
        { id: 1, name: "Maria Santos", email: "maria.santos@school.edu", studentId: "S-1006", status: "submitted", joinedAt: "9:58 AM", score: 96, timeTaken: "14:20" },
        { id: 2, name: "Ava Reyes", email: "ava.reyes@school.edu", studentId: "S-1007", status: "submitted", joinedAt: "10:00 AM", score: 91, timeTaken: "12:47" },
        { id: 3, name: "Liam Cruz", email: "liam.cruz@school.edu", studentId: "S-1008", status: "submitted", joinedAt: "9:59 AM", score: 88, timeTaken: "16:05" },
        { id: 4, name: "Noah Bautista", email: "noah.bautista@school.edu", studentId: "S-1009", status: "submitted", joinedAt: "9:57 AM", score: 74, timeTaken: "19:30" },
        { id: 5, name: "Sophia Lim", email: "sophia.lim@school.edu", studentId: "S-1010", status: "in-progress", joinedAt: "10:03 AM", score: null, timeTaken: null },
        { id: 6, name: "Ethan Garcia", email: "ethan.garcia@school.edu", studentId: "S-1011", status: "in-progress", joinedAt: "10:04 AM", score: null, timeTaken: null },
        { id: 7, name: "Ella Mendoza", email: "ella.mendoza@school.edu", studentId: "S-1012", status: "joined", joinedAt: "10:05 AM", score: null, timeTaken: null },
      ],
    },
    {
      id: 4,
      name: "Web Development",
      code: "IT 103",
      students: 18,
      capacity: 40,
      timeAllotted: 90,
      timeRemaining: "54:02",
      progress: 40,
      status: "live",
      formId: null,
      participants: [
        { id: 1, name: "Zoe Aquino", email: "zoe.aquino@school.edu", studentId: "S-1013", status: "joined", joinedAt: "10:10 AM", score: null, timeTaken: null },
        { id: 2, name: "Miguel Santiago", email: "miguel.santiago@school.edu", studentId: "S-1014", status: "in-progress", joinedAt: "10:11 AM", score: null, timeTaken: null },
      ],
    },
  ],

  subjects: [
    { id: 1, name: "General", code: "", formCount: 5 },
    { id: 2, name: "Programming", code: "CC104", formCount: 0 },
    { id: 3, name: "Programming 2", code: "CC104", formCount: 0 },
  ],

  forms: [
    { id: 1, name: "Untitled Form", description: "No description provided." },
    { id: 2, name: "Untitled Form", description: "No description provided." },
    { id: 3, name: "Untitled Form", description: "No description provided." },
    { id: 4, name: "Untitled Form", description: "No description provided." },
    { id: 5, name: "Untitled Form", description: "No description provided." },
  ],

  stats: { draftQuizzes: 10, recordedQuizzes: 10, subjectsHandled: 112 },

  students: [],

  // 2. Grouped Actions (Cleaner to import and call in components)
  actions: {
    addQuiz: (quiz) =>
      set((state) => ({
        quizzes: [
          ...state.quizzes,
          {
            id: nextId(),
            students: 0,
            progress: 0,
            timeRemaining: `${String(quiz.timeAllotted || 0).padStart(2, "0")}:00`,
            status: "live",
            formId: null,
            participants: [],
            ...quiz,
          },
        ],
      })),

    updateQuiz: (id, patch) =>
      set((state) => ({
        quizzes: state.quizzes.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      })),

    addSubject: (subject) =>
      set((state) => ({
        subjects: [...state.subjects, { id: nextId(), formCount: 0, ...subject }],
      })),

    addForm: (form) =>
      set((state) => ({
        forms: [
          ...state.forms,
          { id: nextId(), description: "No description provided.", ...form },
        ],
      })),

    setStudents: (students) => set({ students }),

    removeStudent: (id) =>
      set((state) => ({ students: state.students.filter((s) => s.id !== id) })),
  },
}));

export const useDashboardActions = () => useDashboardStore((state) => state.actions);

export default useDashboardStore;
