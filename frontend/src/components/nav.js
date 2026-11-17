import { LayoutDashboard, MessageSquareText, ListChecks, ChartColumn } from "lucide-react";

export const NAV_ITEMS = [
  {
    to: "/",
    end: true,
    label: "Dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Your AI-powered study companion.",
  },
  {
    to: "/ask",
    label: "Ask PrepE",
    icon: MessageSquareText,
    title: "Ask PrepE",
    description: "Ask questions about your notes and get answers with page citations.",
  },
  {
    to: "/quiz",
    label: "Quiz PrepE",
    icon: ListChecks,
    title: "Quiz PrepE",
    description: "Generate practice questions and check your understanding.",
  },
  {
    to: "/insights",
    label: "PrepE Insights",
    icon: ChartColumn,
    title: "PrepE Insights",
    description: "Find out which topics past papers test most often.",
  },
];
