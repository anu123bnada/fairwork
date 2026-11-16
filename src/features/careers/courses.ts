// Free learning resources. EVERY entry was opened on the date in `verifiedOn` (an HTTP request to the exact URL answered 200 and the page was the one named) before it was listed.
// Titles are the providers' own. Nothing here is a qualification: a course, badge or certificate of completion does not by itself qualify anyone for a regulated profession or a job.
// Add an entry only after opening its exact URL; never write a URL from memory. `certificate` states what the provider's pages say; "not_stated" means we did not confirm it.
export type CourseCertificate = "none" | "not_stated";
export type LearningFormat = "video" | "reading" | "interactive";
export type Course = {
  id: string;
  title: string;
  provider: string;
  url: string;
  free: true;
  certificate: CourseCertificate;
  /** What the person can rely on about cost. */
  cost: string;
  skills: string[];
  format: LearningFormat;
  /** Only when the provider's own page states it; otherwise null and the screen says "not stated". */
  duration: string | null;
  verifiedOn: string;
  /** How the link was checked. freeCodeCamp pages are rendered in the browser, so only the address (and that it resolves) could be confirmed from outside. */
  verification: "page-title-confirmed" | "address-resolves";
  language: "English";
};

const verifiedOn = "2026-11-16";
export const courses: readonly Course[] = [
  { id: "fcc-responsive-web-design", title: "Responsive Web Design", provider: "freeCodeCamp", url: "https://www.freecodecamp.org/learn/2022/responsive-web-design/", free: true, certificate: "not_stated", cost: "Free to learn. See the provider for what its certificate involves.", skills: ["HTML", "CSS", "Accessibility"], format: "interactive", duration: null, verifiedOn, verification: "address-resolves", language: "English" },
  { id: "fcc-javascript-algorithms", title: "JavaScript Algorithms and Data Structures", provider: "freeCodeCamp", url: "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures-v8/", free: true, certificate: "not_stated", cost: "Free to learn. See the provider for what its certificate involves.", skills: ["JavaScript"], format: "interactive", duration: null, verifiedOn, verification: "address-resolves", language: "English" },
  { id: "mdn-learn-web-development", title: "Learn web development", provider: "MDN Web Docs (Mozilla)", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development", free: true, certificate: "none", cost: "Free reading material. No certificate.", skills: ["HTML", "CSS", "JavaScript"], format: "reading", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "mdn-scripting", title: "Dynamic scripting with JavaScript", provider: "MDN Web Docs (Mozilla)", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting", free: true, certificate: "none", cost: "Free reading material. No certificate.", skills: ["JavaScript"], format: "reading", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "webdev-learn-html", title: "Learn HTML", provider: "web.dev (Google)", url: "https://web.dev/learn/html", free: true, certificate: "none", cost: "Free reading material. No certificate.", skills: ["HTML"], format: "reading", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "webdev-learn-css", title: "Learn CSS", provider: "web.dev (Google)", url: "https://web.dev/learn/css", free: true, certificate: "none", cost: "Free reading material. No certificate.", skills: ["CSS"], format: "reading", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "webdev-learn-accessibility", title: "Learn Accessibility", provider: "web.dev (Google)", url: "https://web.dev/learn/accessibility", free: true, certificate: "none", cost: "Free reading material. No certificate.", skills: ["Accessibility"], format: "reading", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "mslearn-accessibility-fundamentals", title: "Accessibility fundamentals", provider: "Microsoft Learn", url: "https://learn.microsoft.com/en-us/training/paths/accessibility-fundamentals/", free: true, certificate: "not_stated", cost: "Free learning path. Any Microsoft certification exam is separate and paid.", skills: ["Accessibility"], format: "interactive", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "github-what-is-github", title: "What is GitHub?", provider: "GitHub Docs", url: "https://docs.github.com/en/get-started/start-your-journey/what-is-github", free: true, certificate: "none", cost: "Free reading material. No certificate.", skills: ["Version control"], format: "reading", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "github-hello-world", title: "Hello World", provider: "GitHub Docs", url: "https://docs.github.com/en/get-started/start-your-journey/hello-world", free: true, certificate: "none", cost: "Free guided exercise. No certificate.", skills: ["Version control"], format: "interactive", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "kaggle-python", title: "Learn Python", provider: "Kaggle Learn", url: "https://www.kaggle.com/learn/python", free: true, certificate: "not_stated", cost: "Free interactive lessons.", skills: ["Python"], format: "interactive", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "kaggle-pandas", title: "Learn Pandas", provider: "Kaggle Learn", url: "https://www.kaggle.com/learn/pandas", free: true, certificate: "not_stated", cost: "Free interactive lessons.", skills: ["Data analysis"], format: "interactive", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "kaggle-sql", title: "Learn Intro to SQL", provider: "Kaggle Learn", url: "https://www.kaggle.com/learn/intro-to-sql", free: true, certificate: "not_stated", cost: "Free interactive lessons.", skills: ["SQL"], format: "interactive", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "kaggle-data-cleaning", title: "Learn Data Cleaning", provider: "Kaggle Learn", url: "https://www.kaggle.com/learn/data-cleaning", free: true, certificate: "not_stated", cost: "Free interactive lessons.", skills: ["Data cleaning"], format: "interactive", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "kaggle-data-visualization", title: "Learn Data Visualization", provider: "Kaggle Learn", url: "https://www.kaggle.com/learn/data-visualization", free: true, certificate: "not_stated", cost: "Free interactive lessons.", skills: ["Data visualization"], format: "interactive", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "mslearn-data-concepts", title: "Understand data concepts", provider: "Microsoft Learn", url: "https://learn.microsoft.com/en-us/training/paths/understand-data-concepts/", free: true, certificate: "not_stated", cost: "Free learning path. Any Microsoft certification exam is separate and paid.", skills: ["Data concepts"], format: "interactive", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
  { id: "google-technical-writing", title: "Technical Writing", provider: "Google for Developers", url: "https://developers.google.com/tech-writing", free: true, certificate: "none", cost: "Free reading material. No certificate.", skills: ["Clear writing"], format: "reading", duration: null, verifiedOn, verification: "page-title-confirmed", language: "English" },
];

export const courseById = (id: string) => courses.find(course => course.id === id) ?? null;
/** Courses that cover a skill, matched by exact skill name (case-insensitive). The catalog is small on purpose: a skill with no verified course is reported as such, never padded. */
export const coursesForSkill = (skill: string) => courses.filter(course => course.skills.some(covered => covered.toLowerCase() === skill.trim().toLowerCase()));
