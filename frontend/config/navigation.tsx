import {
  BarChart2,
  Briefcase,
  Building2,
  Eye,
  FileText,
  LayoutDashboard,
  User,
  Users,
} from "lucide-react";

export type NavItem = {
  id: string;
  /** i18n key resolved via t() in the Sidebar (e.g. "nav.duty"). */
  labelKey: string;
  href: string;
  icon?: React.ReactNode | null;
  badge?: string | null;
  /** System roles allowed to see this item. Omit = everyone. */
  roles?: string[];
};

export type NavSection = {
  /** i18n key for the section header (e.g. "nav.sectionRequests"). */
  sectionKey: string;
  items: NavItem[];
};

/** Left sidebar navigation. Labels are translation keys, not literals. */
export const navItems: NavSection[] = [
  {
    sectionKey: "nav.sectionDashboard",
    items: [
      {
        id: "dashboard",
        labelKey: "nav.dashboard",
        icon: <LayoutDashboard size={16} />,
        href: "/",
      },
    ],
  },
  {
    sectionKey: "nav.sectionRequests",
    items: [
      {
        id: "requests-duty",
        labelKey: "nav.duty",
        icon: <Briefcase size={16} />,
        href: "/requests/duty",
      },
      {
        id: "requests-mine",
        labelKey: "nav.mine",
        icon: <User size={16} />,
        href: "/requests/mine",
      },
      {
        id: "requests-viewable",
        labelKey: "nav.viewable",
        icon: <Eye size={16} />,
        href: "/requests/viewable",
      },
    ],
  },
  {
    sectionKey: "nav.sectionForms",
    items: [
      {
        id: "forms",
        labelKey: "nav.forms",
        icon: <FileText size={16} />,
        href: "/forms",
      },
    ],
  },
  {
    sectionKey: "nav.sectionStaff",
    items: [
      {
        id: "staff-accounts",
        labelKey: "nav.accounts",
        icon: <Users size={16} />,
        href: "/staff/accounts",
        roles: ["admin"],
      },
      {
        id: "staff-organizations",
        labelKey: "nav.organizations",
        icon: <Building2 size={16} />,
        href: "/staff/organizations",
      },
    ],
  },
  {
    sectionKey: "nav.sectionAnalytics",
    items: [
      {
        id: "reports",
        labelKey: "nav.reports",
        icon: <BarChart2 size={16} />,
        href: "/reports",
      },
    ],
  },
];
