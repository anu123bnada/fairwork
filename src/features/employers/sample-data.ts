// SYNTHETIC SAMPLE employer profiles for demonstration only. Every company, number and statement here was invented for the exhibition. None of it is real, none of it is verified,
// and no real organization is represented. Screens must keep it separate from user-submitted information and from verified facts, and must say it is sample data.
export type SampleEmployer = {
  id: string; name: string; sector: string; location: string; size: string; founded: string; about: string;
  roles: string[]; employmentInfo: { label: string; value: string }[]; askThem: string[];
};

export const sampleEmployers: readonly SampleEmployer[] = [
  { id: "demo-steel", name: "Demo Steel Works (SAMPLE)", sector: "Metal fabrication", location: "Kandy", size: "About 40 people", founded: "2009", about: "A sample workshop that fabricates steel frames and gates.",
    roles: ["Welder", "Fabrication helper", "Site supervisor"], employmentInfo: [{ label: "Typical hours", value: "Monday to Saturday, 8 hours a day" }, { label: "Pay period", value: "Monthly, paid by the 5th" }, { label: "Training", value: "On-the-job, safety briefing in week 1" }],
    askThem: ["Is overtime paid and at what rate?", "Is protective equipment provided?", "Is the contract in writing before the first day?"] },
  { id: "demo-stores", name: "Demo Stores Lanka (SAMPLE)", sector: "Retail", location: "Colombo", size: "About 120 people across 6 shops", founded: "2014", about: "A sample retail chain selling household goods.",
    roles: ["Retail assistant", "Shop supervisor", "Stock clerk"], employmentInfo: [{ label: "Typical hours", value: "Rotating shifts, 6 days a week" }, { label: "Pay period", value: "Monthly" }, { label: "Benefits", value: "Staff discount (sample)" }],
    askThem: ["How are shifts decided and how much notice do I get?", "What happens if I am sick?", "Who do I report to?"] },
  { id: "demo-logistics", name: "Demo Logistics (Pvt) Ltd (SAMPLE)", sector: "Delivery and warehousing", location: "Colombo", size: "About 80 people", founded: "2018", about: "A sample delivery company used in the demo offer. It deliberately has gaps so the offer analysis can show missing information.",
    roles: ["Warehouse assistant", "Delivery driver"], employmentInfo: [{ label: "Typical hours", value: "Not stated" }, { label: "Pay period", value: "Not stated" }],
    askThem: ["What are the exact working hours and is overtime paid?", "What is the notice period on both sides?", "Why is a deposit asked before starting?"] },
  { id: "demo-accounts", name: "Demo Accounting Partners (SAMPLE)", sector: "Accounting services", location: "Galle", size: "About 15 people", founded: "2001", about: "A sample small practice that keeps books for local shops.",
    roles: ["Accounts clerk", "Junior accountant"], employmentInfo: [{ label: "Typical hours", value: "Monday to Friday, 9 to 5" }, { label: "Pay period", value: "Monthly" }, { label: "Training", value: "Study leave for exams (sample)" }],
    askThem: ["Which accounting software do you use?", "Is exam study leave paid?", "What does a typical first month look like?"] },
];
