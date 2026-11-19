// Starter templates for the Forms page gallery (see TemplateGallery.jsx) — grouped the same way
// Google Forms' own template picker groups them, so the pattern is instantly familiar. Picking one
// creates a real form via the existing import path (formsApi.import — the same one a JSON-file
// import already uses), so no separate "create from template" server route is needed.
//
// Each question only needs the fields validateQuestions actually checks (server/forms/routes.js)
// plus whatever the app-level import path stamps in — a fresh id and everything else defaulted is
// fine (see server/forms/repository.js importForm/insertQuestionStmt). `id` here only has to be
// unique within the template; the server mints its own real ids on import.

let n = 0;
const id = () => `t${++n}`;

const shortAnswer = (title, extra = {}) => ({ id: id(), type: "short_answer", title, ...extra });
const paragraph = (title, extra = {}) => ({ id: id(), type: "paragraph", title, ...extra });
const multipleChoice = (title, options, extra = {}) => ({ id: id(), type: "multiple_choice", title, options, ...extra });
const checkboxes = (title, options, extra = {}) => ({ id: id(), type: "checkboxes", title, options, ...extra });
const dropdown = (title, options, extra = {}) => ({ id: id(), type: "dropdown", title, options, ...extra });
const linearScale = (title, extra = {}) => ({
  id: id(),
  type: "linear_scale",
  title,
  scale: { min: 1, max: 5, minLabel: "", maxLabel: "" },
  ...extra,
});
const dateField = (title, extra = {}) => ({ id: id(), type: "date", title, ...extra });

export const TEMPLATE_CATEGORIES = [
  {
    id: "personal",
    name: "Personal",
    templates: [
      {
        id: "contact-information",
        title: "Contact Information",
        description: "Collect a name, email and phone number.",
        accent: "#F5F5F4",
        questions: [
          shortAnswer("Name", { required: true }),
          shortAnswer("Email", { required: true }),
          shortAnswer("Phone number"),
          paragraph("Address"),
        ],
      },
      {
        id: "rsvp",
        title: "RSVP",
        description: "Find out who's coming and how many guests to expect.",
        accent: "#F5F5F4",
        questions: [
          shortAnswer("Name", { required: true }),
          shortAnswer("Email"),
          multipleChoice("Will you attend?", ["Yes", "No", "Maybe"], { required: true }),
          shortAnswer("Number of guests"),
        ],
      },
      {
        id: "party-invite",
        title: "Party Invite",
        description: "An RSVP with a few extra details for the host.",
        accent: "#F5F5F4",
        questions: [
          shortAnswer("Name", { required: true }),
          shortAnswer("Email"),
          multipleChoice("Will you be attending?", ["Yes, I'll be there", "No, I can't make it", "Maybe"], { required: true }),
          shortAnswer("Number of guests"),
          paragraph("Any dietary restrictions?"),
        ],
      },
      {
        id: "t-shirt-sign-up",
        title: "T-Shirt Sign Up",
        description: "Collect sizes and a color preference.",
        accent: "#F5F5F4",
        questions: [
          shortAnswer("Name", { required: true }),
          shortAnswer("Email"),
          multipleChoice("Size", ["XS", "S", "M", "L", "XL", "XXL"], { required: true }),
          dropdown("Color preference", ["Black", "White", "Navy", "Red", "Gray"]),
        ],
      },
      {
        id: "event-registration",
        title: "Event Registration",
        description: "Register attendees and their session preferences.",
        accent: "#F5F5F4",
        questions: [
          shortAnswer("Name", { required: true }),
          shortAnswer("Email", { required: true }),
          shortAnswer("Phone number"),
          checkboxes("Sessions you'd like to attend", ["Morning workshop", "Afternoon panel", "Evening networking"]),
          paragraph("Any special requirements?"),
        ],
      },
    ],
  },
  {
    id: "work",
    name: "Work",
    templates: [
      {
        id: "event-feedback",
        title: "Event Feedback",
        description: "Gauge how an event landed with attendees.",
        accent: "#F5F5F4",
        questions: [
          linearScale("Overall, how would you rate this event?", { scale: { min: 1, max: 5, minLabel: "Poor", maxLabel: "Excellent" } }),
          paragraph("What did you like most?"),
          paragraph("What could we improve?"),
          multipleChoice("Would you attend a future event like this?", ["Yes", "No", "Maybe"]),
        ],
      },
      {
        id: "order-form",
        title: "Order Form",
        description: "Take a simple product order with shipping details.",
        accent: "#F5F5F4",
        questions: [
          shortAnswer("Name", { required: true }),
          shortAnswer("Email", { required: true }),
          dropdown("Item", ["Item A", "Item B", "Item C"], { required: true }),
          shortAnswer("Quantity", { required: true }),
          paragraph("Shipping address", { required: true }),
        ],
      },
      {
        id: "job-application",
        title: "Job Application",
        description: "A starting point for screening candidates.",
        accent: "#F5F5F4",
        questions: [
          shortAnswer("Full name", { required: true }),
          shortAnswer("Email", { required: true }),
          shortAnswer("Phone number"),
          dropdown("Position applying for", ["Position A", "Position B", "Position C"], { required: true }),
          shortAnswer("Resume or portfolio link"),
          paragraph("Why are you interested in this role?"),
        ],
      },
      {
        id: "time-off-request",
        title: "Time Off Request",
        description: "Route leave requests with dates and a reason.",
        accent: "#F5F5F4",
        questions: [
          shortAnswer("Name", { required: true }),
          dateField("Start date", { required: true }),
          dateField("End date", { required: true }),
          multipleChoice("Type", ["Vacation", "Sick leave", "Personal"], { required: true }),
          paragraph("Reason (optional)"),
        ],
      },
      {
        id: "work-request",
        title: "Work Request",
        description: "Intake form for internal task or project requests.",
        accent: "#F5F5F4",
        questions: [
          shortAnswer("Requested by", { required: true }),
          dropdown("Department", ["Operations", "IT", "Marketing", "Facilities"]),
          multipleChoice("Priority", ["Low", "Medium", "High", "Urgent"], { required: true }),
          paragraph("Description of the request", { required: true }),
        ],
      },
      {
        id: "customer-feedback",
        title: "Customer Feedback",
        description: "A short survey to hear from customers.",
        accent: "#F5F5F4",
        questions: [
          linearScale("How satisfied are you with our product/service?", { scale: { min: 1, max: 5, minLabel: "Not satisfied", maxLabel: "Very satisfied" } }),
          checkboxes("What do you value most?", ["Price", "Quality", "Support", "Speed"]),
          paragraph("Any other comments?"),
        ],
      },
    ],
  },
  {
    id: "education",
    name: "Education",
    templates: [
      {
        id: "blank-quiz",
        title: "Blank Quiz",
        description: "One gradable question to build a quiz from.",
        accent: "#F5F5F4",
        questions: [multipleChoice("Question 1", ["Option 1", "Option 2", "Option 3"], { required: true, points: 1 })],
      },
      {
        id: "exit-ticket",
        title: "Exit Ticket",
        description: "A quick check for understanding at the end of class.",
        accent: "#F5F5F4",
        questions: [
          paragraph("What did you learn today?", { required: true }),
          linearScale("How well do you understand today's lesson?", { scale: { min: 1, max: 5, minLabel: "Not at all", maxLabel: "Very well" } }),
          paragraph("Any questions for next class?"),
        ],
      },
      {
        id: "assessment",
        title: "Assessment",
        description: "A short, gradable assessment to build on.",
        accent: "#F5F5F4",
        questions: [
          shortAnswer("Name", { required: true }),
          multipleChoice("Question 1", ["Option 1", "Option 2", "Option 3", "Option 4"], { required: true, points: 1 }),
          shortAnswer("Question 2", { required: true, points: 1 }),
        ],
      },
      {
        id: "worksheet",
        title: "Worksheet",
        description: "Ungraded practice questions.",
        accent: "#F5F5F4",
        questions: [
          shortAnswer("Name", { required: true }),
          shortAnswer("Question 1"),
          shortAnswer("Question 2"),
          paragraph("Question 3"),
        ],
      },
      {
        id: "course-evaluation",
        title: "Course Evaluation",
        description: "End-of-course feedback on the instructor and material.",
        accent: "#F5F5F4",
        questions: [
          shortAnswer("Course name"),
          linearScale("Rate the instructor", { scale: { min: 1, max: 5, minLabel: "Poor", maxLabel: "Excellent" } }),
          paragraph("What worked well?"),
          paragraph("What could be improved?"),
        ],
      },
    ],
  },
];
