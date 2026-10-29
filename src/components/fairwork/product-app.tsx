"use client";

import Link from "next/link";
import Image from "next/image";
import { AppBrandHeader, BrandLogo, ExistingBrand } from "@/components/brand/brand";
import { useRouter, usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { ApiRequestError, appRequest } from "@/features/authority/client";
import type { ErrorCode } from "@/lib/errors";
import { SignInScreen } from "@/components/fairwork/sign-in-screen";
import { NotificationFeed } from "@/components/fairwork/notifications";
import { PlatformNotices } from "@/components/fairwork/platform-notices";
import { PrivacyRequests } from "@/components/fairwork/privacy-requests";
import { AccountSecurity } from "@/components/fairwork/account-security";
import { PassportSharing } from "@/components/fairwork/passport-sharing";
import { AuthInformationLink } from "@/components/fairwork/auth-information-link";
import { agreementReadSchema, type AgreementRead } from "@/features/offer/read-schema";
import { participantOfferId, participantSignInPath } from "@/features/offer/participant-path";
import { EmploymentHistory } from "./employment-history";
import { EvidenceVault } from "./evidence-vault";
import { PlanAssignment, PlanPanel } from "./plan-panel";
import { OrgPlanAssignment } from "./org-plan-panel";
import { MyReports } from "./report-problem";
import { OfferNotes } from "./offer-notes";
import { RetentionPanel } from "./retention-panel";
import { OfferPreparation } from "./offer-preparation";
import { EmploymentTimeline } from "./employment-timeline";
import { buildOfferSummary } from "@/features/offer/summary";
import { ReportQueue } from "./report-queue";
import { DeveloperAccess } from "./developer-access";
import { PayCompare } from "./pay-compare";
import { Reminders } from "./reminders";
import { DataExportPanel } from "./data-export";
import { CompanyResearch } from "./company-research";
import { SelfReportedSkills } from "./self-reported-skills";
import { TrustChain } from "./trust-chain";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import { LOCALES } from "@/i18n";
import { WorkRecordScreen } from "./work-record";
import { DashboardRecords } from "./dashboard-records";
import { OfferDrafts } from "./offer-drafts";
import { SavedOffers, EmployerWorkspace } from "./saved-offers";
import { OpportunitiesScreen } from "./opportunities";
import { GuidanceScreen } from "./guidance";
import { OfferHistoryPanel } from "./offer-history";
import { OfferScreenshot } from "./offer-screenshot";
import { OfferPdf } from "./offer-pdf";
import { OfferDocx } from "./offer-docx";
import { RuleAnalysis } from "./rule-analysis";
import { AiAnalysis } from "./ai-analysis";
import { DraftOfferAssessment, OfferAssessment } from "./offer-assessment";
import { CompanyProfiles } from "./company-profiles";
import { RecruiterVerification } from "./recruiter-verification";
import { OfferCompanySelector } from "./offer-company-selector";
import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
import { CaseReviewScreen } from "./case-review";
import { WorkPassportScreen } from "./work-passport";
import { AgreementWorkflowScreen, CreateVersionedAgreement } from "./agreement-workflow";
import "./product.css";
import "./visual.css";
import "./dark-contrast.css";
import { ProfileEditor } from "@/components/oryqen/profile-editor";
import { meSchema } from "@/features/identity/schema";
import type { z } from "zod";

type Role = "EMPLOYER" | "WORKER";
type FieldQuestion = { id: string; field: string; question: string; required: boolean };
type OfferResult = {
  offerId: string;
  companyId: string;
  workerId: string;
  requesterId: string;
  requesterRole: Role;
  version: number;
  termHash: string;
  snapshot?: Record<string, string | number>;
  representativeId?: string | null;
  changes: Array<{ field: string; previous: string | number | null; current: string | number | null }>;
  unresolved: FieldQuestion[];
  idempotent?: boolean;
};
type AgreementResult = {
  agreementId: string;
  offerId: string;
  version: number;
  confirmedBy: string;
  confirmationRole: Role;
  currentHash: string;
  status: "awaiting_other_party" | "confirmed";
  idempotent?: boolean;
};
type Profile = z.infer<typeof meSchema>;
type ProductContextValue = {
  session: "loading" | "ready" | "anonymous" | "unavailable";
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  offer: OfferResult | null;
  setOffer: (offer: OfferResult | null) => void;
  terms: Record<string, string>;
  setTerms: (terms: Record<string, string>) => void;
  companyId: string;
  setCompanyId: (value: string) => void;
  workerId: string;
  setWorkerId: (value: string) => void;
  role: Role;
  setRole: (role: Role) => void;
  sourceText: string;
  setSourceText: (value: string) => void;
  answered: Set<string>;
  setAnswered: (ids: Set<string>) => void;
  agreement: AgreementResult | null;
  setAgreement: (result: AgreementResult | null) => void;
  agreementId: string;
  ensureAgreementId: () => string;
  ensureOfferId: () => string;
  startSeparateOffer: () => void;
  loadAgreement: (id: string) => Promise<void>;
  loadError: Error | null;
  loadingAgreement: boolean;
  savedAnswers: AgreementRead["answers"];
};

const ProductContext = createContext<ProductContextValue | null>(null);

export function ProductProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ProductContextValue["session"]>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [offer, storeOffer] = useState<OfferResult | null>(null);
  const [terms, setTerms] = useState<Record<string, string>>({});
  const [companyId, setCompanyId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [role, setRole] = useState<Role>("WORKER");
  const [sourceText, setSourceText] = useState("");
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [agreement, setAgreement] = useState<AgreementResult | null>(null);
  const [agreementId, setAgreementId] = useState("");
  const [draftOfferId, setDraftOfferId] = useState("");
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [loadingAgreement, setLoadingAgreement] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<AgreementRead["answers"]>([]);
  const loadGeneration = useRef(0);

  const restore = useCallback((saved: AgreementRead, actor: string) => {
    storeOffer(saved.offer);
    setCompanyId(saved.offer.companyId);
    setWorkerId(saved.offer.workerId);
    setTerms(Object.fromEntries(Object.entries(saved.offer.snapshot).map(([key, value]) => [key, String(value)])));
    setRole(actor === saved.offer.workerId ? "WORKER" : "EMPLOYER");
    setAnswered(new Set(saved.answers.map((answer) => answer.questionId)));
    setSavedAnswers(saved.answers);
    setAgreement(saved.confirmation);
    setAgreementId(saved.agreementId);
  }, []);

  const loadAgreement = useCallback(async (id: string) => {
    const generation = ++loadGeneration.current;
    setLoadingAgreement(true);
    setLoadError(null);
    storeOffer(null);
    setAgreement(null);
    try {
      const saved = agreementReadSchema.parse(await appRequest(`/api/v1/agreements?offerId=${encodeURIComponent(id)}`));
      if (generation !== loadGeneration.current) return;
      restore(saved, profile?.id ?? "");
      rememberOffer(id);
    } catch (error) {
      if (generation === loadGeneration.current) setLoadError(error instanceof ApiRequestError ? error : new Error("Saved terms could not be verified. Try loading again."));
    } finally {
      if (generation === loadGeneration.current) setLoadingAgreement(false);
    }
  }, [profile, restore]);

  const setOffer = useCallback((next: OfferResult | null) => {
    ++loadGeneration.current;
    setLoadingAgreement(false);
    setLoadError(null);
    storeOffer(next);
    if (next) rememberOffer(next.offerId);
    setAnswered(new Set());
    setSavedAnswers([]);
    setAgreement(null);
    setAgreementId("");
  }, []);

  useEffect(() => {
    let active = true;
    appRequest("/api/v1/me")
      .then(async (result: Profile) => {
        if (!active) return;
        setProfile(result);
        const query = new URLSearchParams(window.location.search);
        const explicitId = participantOfferId(query.toString());
        if (query.has("offerId") && !explicitId) {
          setLoadError(new Error("The offer link is invalid or ambiguous. Open an offer from your saved list."));
          setSession("ready");
          return;
        }
        const id = /\/(agreement-workflow|work-record|cases)$/.test(window.location.pathname) ? null : explicitId ?? rememberedOffer();
        if (id) {
          try {
            const saved = agreementReadSchema.parse(await appRequest(`/api/v1/agreements?offerId=${encodeURIComponent(id)}`));
            if (!active) return;
            restore(saved, result.id);
            rememberOffer(id);
          } catch (error) {
            if (!active) return;
            setLoadError(error instanceof ApiRequestError ? error : new Error("Saved terms could not be verified. Try loading again."));
          }
        }
        setSession("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiRequestError && error.code === "AUTH_REQUIRED") {
          setSession("anonymous");
        } else {
          setSession("unavailable");
        }
      });
    return () => {
      active = false;
    };
  }, [restore]);

  const ensureAgreementId = useCallback(() => {
    const id = agreementId || crypto.randomUUID();
    if (!agreementId) setAgreementId(id);
    return id;
  }, [agreementId]);
  const ensureOfferId = useCallback(() => {
    const id = draftOfferId || crypto.randomUUID();
    if (!draftOfferId) setDraftOfferId(id);
    return id;
  }, [draftOfferId]);

  const startSeparateOffer = useCallback(() => {
    setOffer(null); // Invalidates pending loads and clears confirmation/answers.
    setDraftOfferId("");
    setTerms({});
    setSourceText("");
    setCompanyId("");
    setWorkerId(profile?.id ?? "");
    setRole("WORKER");
    try { window.sessionStorage.removeItem("fairwork.offer-selection"); } catch { /* Optional non-secret selection only. */ }
  }, [profile?.id, setOffer]);

  const value = useMemo<ProductContextValue>(() => ({
    session,
    profile,
    setProfile,
    offer,
    setOffer,
    terms,
    setTerms,
    companyId,
    setCompanyId,
    workerId,
    setWorkerId,
    role,
    setRole,
    sourceText,
    setSourceText,
    answered,
    setAnswered,
    agreement,
    setAgreement,
    agreementId,
    ensureAgreementId,
    ensureOfferId,
    startSeparateOffer,
    loadAgreement, loadError, loadingAgreement, savedAnswers,
  }), [
    session, profile, offer, setOffer, terms, companyId, workerId, role, sourceText,
    answered, agreement, agreementId, ensureAgreementId, ensureOfferId, startSeparateOffer, loadAgreement, loadError, loadingAgreement, savedAnswers,
  ]);

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

// Only a non-secret selection ID is retained; terms, answers, tokens and
// confirmations always come from the authenticated server on a fresh load.
function rememberOffer(id: string) {
  try { window.sessionStorage.setItem("fairwork.offer-selection", id); } catch { /* Storage is optional. */ }
}
function rememberedOffer() {
  try { return window.sessionStorage.getItem("fairwork.offer-selection"); } catch { return null; }
}

function useProduct() {
  const context = useContext(ProductContext);
  if (!context) throw new Error("ProductProvider is missing");
  return context;
}

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (name === "back") return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
  if (name === "bell") return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
  if (name === "home") return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "badge") return <svg {...common}><path d="m12 3 2.2 2.1 3-.2.8 2.9 2.6 1.5-1 2.8 1 2.8-2.6 1.5-.8 2.9-3-.2L12 21l-2.2-2.1-3 .2-.8-2.9-2.6-1.5 1-2.8-1-2.8L6 7.6l.8-2.9 3 .2Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  if (name === "circle-check") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
  if (name === "question") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.6 2.6 0 1 1 4.4 1.9c-1.1.9-1.9 1.2-1.9 2.6" /><path d="M12 17h.01" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></svg>;
}

const screenTitle: Record<string, string> = {
  home: "Home",
  opportunities: "Opportunities",
  guidance: "Guidance",
  "add-offer": "Add offer",
  analyzing: "Understanding",
  check: "ORYQEN Check",
  questions: "Questions",
  agreement: "Agreement",
  "agreement-workflow": "Agreement",
  "work-record": "Work record",
  cases: "Case review",
  passport: "Work Passport",
  settings: "Settings",
  employer: "Employer",
  notifications: "Notifications",
  share: "Share your passport",
  "intro-welcome": "Welcome",
};

const backTarget: Record<string, string> = {
  opportunities: "home",
  guidance: "home",
  "add-offer": "home",
  analyzing: "add-offer",
  check: "home",
  questions: "check",
  agreement: "questions",
  "agreement-workflow": "agreement",
  "work-record": "home",
  cases: "work-record",
  passport: "home",
  settings: "home",
  employer: "settings",
  notifications: "home",
  share: "passport",
};

function routeFor(screen: string) {
  return `/app/${screen}`;
}

function previewRouteFor(screen: string, demoPreview: boolean) {
  return `${routeFor(screen)}${demoPreview ? "?preview=demo" : ""}`;
}

// Sample-data previews are a design aid. A build connected to a real backend does not advertise them to signed-in people; the labelled preview URL still works.
const REAL_BACKEND = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
function ProductHeader({ screen, title, demoPreviewLink = false }: { screen: string; title?: string; demoPreviewLink?: boolean }) {
  const back = backTarget[screen];
  return (
    <header className="fw-product-header">
      {back ? <Link className="fw-back" href={routeFor(back)} aria-label="Back"><Icon name="back" /></Link> : <span />}
      {title === "" ? <span aria-hidden="true" /> : <h1>{title ?? screenTitle[screen] ?? "ORYQEN"}</h1>}
      {screen === "home" ? (
        <Link className="fw-header-icon" href={routeFor("notifications")} aria-label="Notifications"><Icon name="bell" size={20} /></Link>
      ) : demoPreviewLink && !REAL_BACKEND ? (
        <Link className="fw-demo-header-link" href={`${routeFor(screen)}?preview=demo`}>Demo</Link>
      ) : <span className="fw-header-placeholder" />}
    </header>
  );
}

function BottomNav({ active, demoPreview }: { active: string; demoPreview: boolean }) {
  const { t } = useI18n();
  const items = [
    ["home", t("nav.home"), "home"],
    ["check", t("nav.check"), "shield"],
    ["work-record", t("nav.record"), "clock"],
    ["passport", t("nav.passport"), "badge"],
  ] as const;
  const more = [["opportunities", t("nav.opportunities")], ["agreement-workflow", t("nav.agreements")], ["cases", t("nav.cases")], ["guidance", t("nav.guidance")], ["notifications", t("nav.notifications")], ["settings", t("nav.settings")]] as const;
  const current = (usePathname() ?? "").split("/").pop() ?? "";
  return (
    <nav className="fw-bottom-nav" aria-label="Main navigation">
      <span className="fw-nav-brand" aria-hidden="true"><Icon name="shield" size={20} />ORYQEN</span>
      {items.map(([route, label, icon]) => (
        <Link key={route} className={`fw-nav-link${active === route ? " active" : ""}`} href={previewRouteFor(route, demoPreview)} aria-current={active === route ? "page" : undefined}>
          <Icon name={icon} size={22} />
          <span>{label}</span>
        </Link>
      ))}
      {!demoPreview && <div className="fw-nav-more">
        <span className="fw-nav-more-title">{t("nav.more")}</span>
        {more.map(([route, label]) => <Link key={route} className={`fw-nav-sub${current === route ? " active" : ""}`} href={routeFor(route)} aria-current={current === route ? "page" : undefined}>{label}</Link>)}
      </div>}
    </nav>
  );
}

function DeviceStatus() {
  return <div className="fw-device-status" aria-hidden="true"><span>9:41</span><span className="fw-device-icons"><span className="fw-signal" /><span className="fw-battery" /></span></div>;
}

function ErrorMessage({ error }: { error: Error | null }) {
  if (!error) return null;
  const copy: Partial<Record<ErrorCode, string>> = {
    VALIDATION_FAILED: "Check the offer fields and try again.",
    ACTION_FORBIDDEN: "Your signed-in account is not authorized for this action.",
    VERSION_CONFLICT: "This offer changed. Return to the offer and review the latest version.",
    AUTH_REQUIRED: "Your session ended. Sign in again to continue.",
    RATE_LIMITED: "Too many requests. Wait briefly before trying again.",
    SERVICE_UNAVAILABLE: "ORYQEN could not reach the secure service. Your changes were not confirmed.",
  };
  const message = error instanceof ApiRequestError ? copy[error.code] ?? error.message : error.message;
  return <p className="fw-error" role="alert">{message}</p>;
}

function ProductGate({ children }: { children: ReactNode }) {
  const { session, loadError, loadingAgreement } = useProduct();
  if (session === "loading") return <p role="status" className="fw-notice">Loading your private ORYQEN session…</p>;
  if (session === "anonymous") {
    return <div className="fw-card" style={{ padding: 20 }}><h2>Sign in to continue</h2><p>Your offers, agreements and work records are available only to an authenticated account.</p><Link className="fw-primary" href={participantSignInPath(window.location.pathname, window.location.search)}>Sign in</Link></div>;
  }
  if (session === "unavailable") {
    return <div className="fw-card" style={{ padding: 20 }}><h2>Secure service unavailable</h2><p role="alert">We could not verify your session. No offer or agreement action was sent.</p><Link href="/sign-in">Return to sign in</Link></div>;
  }
  if (loadingAgreement) return <p role="status" className="fw-notice">Loading saved agreement…</p>;
  return <><ErrorMessage error={loadError} />{children}</>;
}

function OpenSavedAgreement() {
  const { loadAgreement } = useProduct();
  const [id, setId] = useState("");
  const router = useRouter();
  return <form className="fw-card fw-offer-detail-card" onSubmit={(event) => {
    event.preventDefault();
    void loadAgreement(id.trim());
    router.push(routeFor("agreement"));
  }}>
    <label className="fw-field">Open saved offer ID<input required pattern={"[0-9a-fA-F\\-]{36}"} value={id} onChange={(event) => setId(event.target.value)} /></label>
    <button type="submit" className="fw-secondary">Open saved agreement</button>
    <p className="fw-notice">Only the designated participants can open this record.</p>
  </form>;
}

export function FairworkScreen({ screen, demoPreview = false }: { screen: string; demoPreview?: boolean }) {
  const { session, loadingAgreement } = useProduct();
  const valid = Object.keys(screenTitle).includes(screen);
  const active = screen === "add-offer" || screen === "analyzing" ? "home"
    : screen === "questions" || screen === "agreement" || screen === "agreement-workflow" ? "check"
      : screen === "cases" ? "work-record" : screen;
  if (!valid) return <main className="fw-product"><DeviceStatus /><AppBrandHeader /><div className="fw-product-body"><h1>Screen unavailable</h1><Link href={routeFor("home")}>Go home</Link></div></main>;
  return (
    <main className={`fw-product fw-screen-${screen}`}>
      <DeviceStatus />
      {(screen !== "share" || session !== "ready" || loadingAgreement) && <AppBrandHeader prominent={screen === "intro-welcome"} />}
      <ProductGate>
        <PlatformNotices />
        <ScreenContent screen={screen} demoPreview={demoPreview} />
      </ProductGate>
      {session === "ready" && !["share", "settings", "employer", "notifications", "intro-welcome"].includes(screen) && <BottomNav active={active} demoPreview={demoPreview} />}
    </main>
  );
}


// The offer journey as one visible path. It only labels screens that already exist and links to those the person has reached; nothing here is a new feature.
const FLOW = [["add-offer", "flow.add"], ["check", "flow.review"], ["questions", "flow.questions"], ["agreement", "flow.save"]] as const;
function FlowSteps({ screen }: { screen: string }) {
  const { t } = useI18n();
  const index = Math.max(0, FLOW.findIndex(([route]) => route === (screen === "analyzing" ? "add-offer" : screen)));
  return <ol className="fw-flow" aria-label={t("flow.aria")}>
    {FLOW.map(([route, key], position) => <li key={route} className={position === index ? "is-current" : position < index ? "is-done" : ""} aria-current={position === index ? "step" : undefined}>
      <span className="fw-flow-dot" aria-hidden="true">{position < index ? "✓" : position + 1}</span>
      {position < index ? <Link href={routeFor(route)}>{t(key)}</Link> : <span>{t(key)}</span>}
    </li>)}
  </ol>;
}

function ScreenContent({ screen, demoPreview }: { screen: string; demoPreview: boolean }) {
  const { profile } = useProduct();
  const bodyClass = screen === "home" ? "fw-product-body fw-home-body" : "fw-product-body";
  return (
    <div className={`${bodyClass}${screen === "home" && demoPreview ? " fw-home-demo-body" : ""} fw-screen-enter`} key={screen}>
      {screen !== "home" && screen !== "intro-welcome" && screen !== "settings" && screen !== "employer" && screen !== "share" && screen !== "notifications" ? <ProductHeader screen={screen} demoPreviewLink={!demoPreview && screen === "passport"} /> : null}
      {["work-record", "passport"].includes(screen) && demoPreview && <DemoPreviewControl screen={screen} enabled />}
      {screen === "home" && demoPreview && <DemoPreviewControl screen={screen} enabled />}
      {["add-offer", "analyzing", "check", "questions", "agreement"].includes(screen) && !demoPreview ? <FlowSteps screen={screen} /> : null}
      {screen === "home" ? <HomeScreen profile={profile} demoPreview={demoPreview} /> : null}
      {screen === "opportunities" && profile ? <OpportunitiesScreen /> : null}
      {screen === "guidance" && profile ? <GuidanceScreen /> : null}
      {screen === "intro-welcome" ? <AuthenticatedWelcome profile={profile} /> : null}
      {screen === "add-offer" ? <AddOfferScreen /> : null}
      {screen === "analyzing" ? <AnalyzingScreen /> : null}
      {screen === "check" ? <CheckScreen /> : null}
      {screen === "questions" ? <QuestionsScreen /> : null}
      {screen === "agreement" ? <AgreementScreen /> : null}
      {screen === "agreement-workflow" && profile ? <AgreementWorkflowScreen actorId={profile.id} /> : null}
      {screen === "cases" && profile ? <CaseReviewScreen /> : null}
      {screen === "work-record" ? demoPreview ? <PreviewScreen screen="work-record" profile={profile} demoPreview /> : profile ? <><WorkRecordScreen actorId={profile.id} /><EmploymentTimeline /><EmploymentHistory /><EvidenceVault /></> : null : null}
      {screen === "passport" ? demoPreview ? <PreviewScreen screen="passport" profile={profile} demoPreview /> : profile ? <><WorkPassportScreen displayName={profile.displayName} /><TrustChain /><SelfReportedSkills /></> : null : null}
      {screen === "settings" ? <SettingsScreen profile={profile} /> : null}
      {screen === "employer" ? demoPreview ? <PreviewScreen screen="employer" profile={profile} /> : <EmployerWorkspace /> : null}
      {screen === "notifications" ? <NotificationsScreen /> : null}
      {screen === "share" ? <><ProductHeader screen="passport" />{demoPreview ? <PreviewScreen screen="passport" profile={profile} demoPreview /> : <p className="fw-notice">Manage access to selected verified work below. Sharing uses your saved Passport and checks current eligibility.</p>}<ShareSheet /></> : null}
    </div>
  );
}

function DemoPreviewControl({ screen, enabled }: { screen: string; enabled: boolean }) {
  if (REAL_BACKEND && !enabled) return null;
  return (
    <div className={`fw-demo-control${enabled ? " is-active" : ""}`}>
      {enabled ? (
        <>
          <span className="fw-demo-label">DEMO PREVIEW · FIGMA SAMPLE · NOT VERIFIED OR SAVED</span>
          <Link href={routeFor(screen)} aria-label="Exit demo preview">Exit</Link>
        </>
      ) : (
        <Link href={`${routeFor(screen)}?preview=demo`}>View Figma sample <span aria-hidden="true">↗</span></Link>
      )}
    </div>
  );
}

function HomeScreen({ profile, demoPreview }: { profile: Profile | null; demoPreview: boolean }) {
  const { offer } = useProduct();
  const { t } = useI18n();
  const terms = Object.fromEntries(Object.entries(offer?.snapshot ?? {}).map(([key, value]) => [key, String(value)]));
  const name = demoPreview ? "Nimal Perera" : profile?.displayName || "ORYQEN member";
  const unresolvedFields = new Set(offer?.unresolved.map((question) => question.field) ?? []);
  const statusText = offer
    ? offer.unresolved.length
      ? t(offer.unresolved.length === 1 ? "home.statusOne" : "home.statusMany", { count: offer.unresolved.length })
      : t("home.statusReview")
    : t("home.statusAdd");
  if (demoPreview) {
    return (
      <div className="fw-figma-home">
        <div className="fw-home-topline">
          <span className="fw-eyebrow">ORYQEN · Your work, your record</span>
          <div className="fw-home-actions">
            <Link className="fw-alert-dot" href={routeFor("notifications")} aria-label="Notifications"><Icon name="bell" size={20} /><i aria-hidden="true" /></Link>
            <Link className="fw-avatar fw-home-avatar" href={routeFor("settings")} aria-label="Open settings">N<span className="fw-online-dot" aria-hidden="true" /></Link>
          </div>
        </div>
        <div className="fw-home-greeting">
          <span className="fw-home-location">Thu, 2 Oct · Kurunegala</span>
          <h2>Good morning, Nimal</h2>
        </div>
        <span className="fw-offer-alert"><span className="fw-alert-indicator" />You have 1 job offer to review</span>
        <section className="fw-card fw-offer-card fw-home-offer fw-figma-offer-card">
          <div className="fw-home-offer-heading">
            <span className="fw-company-mark">A</span>
            <span><strong>Motorcycle Technician</strong><br /><span className="fw-offer-employer">AutoCare Garage · Kurunegala</span></span>
          </div>
          <div className="fw-demo-employment"><span>FULL-TIME</span><span>ON-SITE</span></div>
          <div className="fw-demo-salary"><strong>LKR 45,000–60,000</strong><span>/ month</span></div>
          <div className="fw-demo-offer-checks">
            <span className="positive"><Icon name="check" size={14} />Salary stated</span>
            <span className="positive"><Icon name="check" size={14} />Location stated</span>
            <span className="caution"><Icon name="clock" size={14} />Overtime unclear</span>
            <span className="caution"><Icon name="clock" size={14} />Payment date missing</span>
          </div>
          <Link className="fw-full-dark-link" href={routeFor("check")}>Review offer <Icon name="arrow" size={18} /></Link>
        </section>
        <Link className="fw-profile-card fw-demo-passport-teaser" href={previewRouteFor("passport", true)}>
          <span className="fw-demo-progress-ring">73%</span>
          <span><strong>Your work profile</strong><br /><span className="fw-offer-employer">73% sample profile · 2 roles · 4 skills</span></span>
          <span className="fw-chevron" aria-hidden="true">›</span>
        </Link>
        <div className="fw-hint-card"><strong>Before you accept → verify.</strong><br />ORYQEN never judges employers. It shows what’s clear and what’s missing.</div>
      </div>
    );
  }
  return (
    <div className="fw-dash">
      <header className="fw-dash-hero">
        <div className="fw-home-topline">
          <span className="fw-eyebrow">{t("home.eyebrow")}</span>
          <div className="fw-home-actions">
            <Link className="fw-alert-dot" href={routeFor("notifications")} aria-label={t("home.notifications")}><Icon name="bell" size={20} /></Link>
            <Link className="fw-avatar fw-home-avatar" href={routeFor("settings")} aria-label={t("home.openSettings")}>{name.slice(0, 1).toUpperCase()}</Link>
          </div>
        </div>
        <div className="fw-home-greeting">
          <span className="fw-home-location">{t("home.workspace")}</span>
          {!REAL_BACKEND && <Link className="fw-home-demo-link" href={`${routeFor("home")}?preview=demo`}>Figma sample</Link>}
          <h2>{t("home.greeting", { name: name.split(" ")[0]! })}</h2>
        </div>
        <Link className="fw-offer-alert" href={routeFor(offer ? "check" : "add-offer")}><span className="fw-alert-indicator" />{statusText}</Link>
        <section className="fw-card fw-offer-card fw-home-offer">
          <div className="fw-home-offer-heading">
            <span className="fw-company-mark" aria-hidden="true">{offer ? "✓" : "F"}</span>
            <span><strong>{offer ? terms.role || t("home.submittedOffer") : t("home.understand")}</strong><br /><span className="fw-offer-employer">{offer ? t("home.revision", { version: offer.version }) : t("home.addPrompt")}</span></span>
          </div>
          {offer ? <div className="fw-home-pay">
            <strong>{terms.currency ? `${terms.currency} ` : ""}{terms.salary ?? t("home.payNotStated")}</strong>
            <span>{terms.hoursPerWeek ? t("home.hoursPerWeek", { hours: terms.hoursPerWeek }) : t("home.hoursNotStated")}</span>
          </div> : null}
          <div className="fw-home-empty-terms">
            <span><Icon name="check" size={14} />{offer ? (unresolvedFields.has("salary") ? t("home.payNeedsClarification") : t("home.payStated")) : t("home.addTerms")}</span>
            <span><Icon name="clock" size={14} />{offer ? (offer.unresolved.length ? t("home.questionsToAsk") : t("home.termsToReview")) : t("home.clarifyMissing")}</span>
          </div>
          <Link className="fw-full-dark-link" href={routeFor(offer ? "check" : "add-offer")}>{offer ? t("home.reviewOffer") : t("home.addOffer")} <Icon name="arrow" size={18} /></Link>
        </section>
      </header>
      <div className="fw-dash-rail">
        <Link className="fw-profile-card" href={routeFor("passport")} style={{ color: "inherit", textDecoration: "none" }}>
          <span className="fw-progress-ring"><Icon name="badge" size={22} /></span>
          <span><strong>{t("home.passportTitle")}</strong><br /><span className="fw-offer-employer">{t("home.passportBody")}</span></span>
          <span className="fw-chevron" aria-hidden="true">›</span>
        </Link>
        <Reminders />
        <details className="fw-list-card" open><summary>{t("home.recent")}</summary><NotificationFeed /></details>
        <div className="fw-dash-links">
          <Link className="fw-secondary" href="/app/opportunities">{t("home.discover")}</Link>
          <Link className="fw-secondary" href="/app/guidance">{t("home.guidance")}</Link>
        </div>
        <div className="fw-hint-card"><strong>{t("home.hintStrong")}</strong><br />{t("home.hintBody")}</div>
      </div>
      <div className="fw-dash-main">
        <SavedOffers />
        <DashboardRecords />
        <details className="fw-list-card"><summary>{t("pay.title")}</summary><PayCompare /></details>
        <CompanyResearch />
        <details className="fw-list-card fw-advanced"><summary>{t("home.advanced")}</summary>
          <p className="fw-notice">{t("home.advancedNote")}</p>
          <OpenSavedAgreement />
          <CompanyProfiles />
        </details>
      </div>
    </div>
  );
}

function AuthenticatedWelcome({ profile }: { profile: Profile | null }) {
  return (
    <div className="fw-authenticated-welcome">
      <header className="fw-welcome-brand">
        <ExistingBrand><span className="mark" aria-hidden="true"><Icon name="shield" size={24} /></span><span>ORYQEN</span></ExistingBrand>
        <span className="fw-welcome-language" title="English is available; Sinhala and Tamil translations are not yet available.">EN · සිං · தமிழ்</span>
      </header>
      <section className="fw-welcome-hero">
        <span className="fw-pill">● &nbsp; SDG 8 · DECENT WORK</span>
        <h1>Know what<br />you’re<br />agreeing to.</h1>
        <p>Understand job offers, clarify<br />important terms, and keep a record of<br />what was agreed.</p>
        <span className="fw-screen-reader">Signed in as {profile?.displayName || "ORYQEN member"}.</span>
      </section>
      <section className="fw-card fw-before-during-after">
        <span className="fw-eyebrow">BEFORE · DURING · AFTER</span>
        <div className="fw-signatures">
          <div className="fw-signature"><strong>Understand</strong><br /><span className="fw-offer-employer">Before work</span></div>
          <div className="fw-signature"><strong>Record</strong><br /><span className="fw-offer-employer">During work</span></div>
          <div className="fw-signature"><strong>Prove</strong><br /><span className="fw-offer-employer">After work</span></div>
        </div>
      </section>
      <div className="fw-intro-actions">
        <Link className="fw-primary" href={routeFor("home")}>Check a job offer <Icon name="arrow" size={18} /></Link>
        <Link className="fw-secondary" href={routeFor("passport")}>View my Work Passport</Link>
        <p>Private by design · You make the decision</p>
      </div>
    </div>
  );
}

function AddOfferScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { profile, offer, setOffer, terms, setTerms, companyId, setCompanyId, workerId, setWorkerId, role, setRole, sourceText, setSourceText, ensureOfferId, startSeparateOffer } = useProduct();
  const [tab, setTab] = useState<"paste" | "screenshot" | "pdf" | "manual">("paste");
  const [extraction, setExtraction] = useState<{ text: string; filled: number; preserved: number } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const requestKeys = useRef(new Map<string, string>());

  useEffect(() => {
    if (role === "WORKER" && profile?.id && !workerId) setWorkerId(profile.id);
  }, [profile?.id, workerId, role, setWorkerId]);

  function updateTerm(field: string, value: string) {
    setTerms({ ...terms, [field]: value });
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formElement = event.currentTarget;
    const invalid = Array.from(formElement.elements).find(element =>
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) && !element.validity.valid,
    ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | undefined;
    if (invalid) {
      const label = invalid.labels?.[0]?.textContent?.trim() ?? "Offer field";
      setError(new Error(invalid.name === "companyId" ? "Select a linked organization before saving. If none are available, use the participant-link or organization-approval steps below." : `${label}: ${invalid.validationMessage}`));
      invalid.focus();
      return;
    }
    const form = new FormData(event.currentTarget);
    if (!String(form.get("role") ?? "").trim()) {
      setError(new Error("Enter a role title. Pasted text must be reviewed in the offer fields before saving."));
      formElement.querySelector<HTMLInputElement>('[name="role"]')?.focus();
      return;
    }
    setBusy(true);
    const normalizedTerms: Record<string, string | number> = {
      // Keep persisted extension fields that this editor does not render.
      // A rendered field is removed only when the user explicitly clears it.
      ...(offer?.snapshot ?? {}),
      role: String(form.get("role") ?? "").trim(),
    };
    // Omit unknown terms so the database can generate its missing-field questions.
    // Supplied numeric values still pass native and strict API validation.
    for (const field of ["salary", "currency", "startDate", "hoursPerWeek", "responsibilities", "location", "overtime", "paymentDate", "safety", "benefits", "employmentType", "probation", "notice", "deductions", "contractConditions", "payPeriod", "taxBasis", "schedule", "leave", "contractDuration", "trainingDeposit", "documentRetention", "employerName"]) {
      const value = String(form.get(field) ?? "").trim();
      if (value) normalizedTerms[field] = field === "salary" || field === "hoursPerWeek" ? Number(value) : value;
      else delete normalizedTerms[field];
    }
    const requestBody = {
      offerId: offer?.offerId ?? ensureOfferId(),
      companyId: String(form.get("companyId") ?? "").trim(),
      workerId: String(form.get("workerId") ?? "").trim(),
      requesterRole: role,
      terms: normalizedTerms,
      expectedVersion: (offer?.version ?? 0) + 1,
    };
    const fingerprint = JSON.stringify(requestBody);
    let key = requestKeys.current.get(fingerprint);
    if (!key) {
      key = crypto.randomUUID();
      requestKeys.current.set(fingerprint, key);
    }
    try {
      const result = await appRequest("/api/v1/offers", {
        ...requestBody,
        idempotencyKey: key,
      }) as OfferResult;
      setOffer(result);
      setCompanyId(requestBody.companyId);
      setWorkerId(requestBody.workerId);
      setTerms(Object.fromEntries(Object.entries(normalizedTerms).map(([name, value]) => [name, String(value)])));
      if (!offer) {
        // The source text is retained only for this in-memory display. The current
        // backend contract persists typed terms, not pasted source content.
        setSourceText(sourceText);
      }
      router.push(routeFor("analyzing"));
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("The offer could not be checked."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="fw-page-title">{t("add.title")}</h2>
      <p className="fw-page-subtitle">{t("add.subtitle")}</p>
      <OfferDrafts onUse={draft=>{startSeparateOffer();setTerms({role:draft.role,employerName:draft.employer});setSourceText(draft.text);setExtraction(null);setError(null);requestKeys.current.clear();router.replace("/app/add-offer");}} />
      {offer && <section className="fw-card fw-offer-detail-card" aria-label="Selected offer">
        <p>{t("add.editing", { version: offer.version })}</p>
        <button type="button" className="fw-secondary" disabled={busy} onClick={() => {
          startSeparateOffer(); setExtraction(null); setError(null); requestKeys.current.clear();
          router.replace("/app/add-offer");
        }}>{t("add.separate")}</button>
      </section>}
      <div className="fw-mode-tabs" role="tablist" aria-label={t("add.methodAria")}>
        <button type="button" role="tab" aria-selected={tab === "paste"} className={tab === "paste" ? "active" : ""} onClick={() => setTab("paste")}>{t("add.tabPaste")}</button>
        <button type="button" role="tab" aria-selected={tab === "screenshot"} className={tab === "screenshot" ? "active" : ""} onClick={() => setTab("screenshot")}>{t("add.tabScreenshot")}</button>
        <button type="button" role="tab" aria-selected={tab === "pdf"} className={tab === "pdf" ? "active" : ""} onClick={() => setTab("pdf")}>{t("add.tabPdf")}</button>
        <button type="button" role="tab" aria-selected={tab === "manual"} className={tab === "manual" ? "active" : ""} onClick={() => setTab("manual")}>{t("add.tabManual")}</button>
      </div>
      {tab === "screenshot" ? (
        <OfferScreenshot onReviewed={text=>{setSourceText(text);setTab("paste");}}/>
      ) : tab === "pdf" ? (
        <><OfferPdf onReviewed={text=>{setSourceText(text);setTab("paste");}}/><OfferDocx onReviewed={text=>{setSourceText(text);setTab("paste");}}/></>
      ) : (
        <form noValidate onSubmit={(event) => void analyze(event)}>
          {error && <ErrorMessage error={error} />}
          {tab === "paste" && (
            <section className="fw-source-panel">
              <label className="fw-source-label">{t("add.pasteLabel")}
                <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder={t("add.pastePlaceholder")} maxLength={10000} />
              </label>
              <p className="fw-disclaimer">{t("add.pasteNote")}</p>
              <button type="button" className="fw-secondary" disabled={!sourceText.trim()} onClick={() => {
                const { detectedTerms } = extractOfferTermsRuleBased(sourceText);
                const blankFields = Object.entries(detectedTerms).filter(([field]) => !terms[field]?.trim());
                setTerms({ ...terms, ...Object.fromEntries(blankFields.map(([field, value]) => [field, String(value)])) });
                setExtraction({ text: sourceText, filled: blankFields.length, preserved: Object.keys(detectedTerms).length - blankFields.length });
              }}>{t("add.suggest")}</button>
              {extraction && extraction.text === sourceText && <><p role="status">{extraction.filled ? t("add.filled", { count: extraction.filled }) : t("add.nothingFilled")} {extraction.preserved ? t("add.preserved", { count: extraction.preserved }) : !extraction.filled ? t("add.noneDetected") : ""} {t("add.reviewEvery")}</p><RuleAnalysis text={extraction.text} /></>}
              <AiAnalysis text={sourceText} role={role} />
            </section>
          )}
          <section className="fw-card fw-offer-detail-card" aria-label={t("add.termsAria")}>
            <strong>{t("add.details")}</strong>
            <p className="fw-notice">{t("add.leaveBlank")}</p>
            <label className="fw-field">{t("add.f.role")}<input name="role" required maxLength={120} value={terms.role ?? ""} onChange={(event) => updateTerm("role", event.target.value)} /></label>
            <label className="fw-field">{t("add.f.salary")}<input name="salary" type="number" min="0.01" step="0.01" value={terms.salary ?? ""} onChange={(event) => updateTerm("salary", event.target.value)} /></label>
            <label className="fw-field">{t("add.f.currency")}<input name="currency" maxLength={10} value={terms.currency ?? ""} onChange={(event) => updateTerm("currency", event.target.value)} /></label>
            <label className="fw-field">{t("add.f.startDate")}<input name="startDate" maxLength={80} value={terms.startDate ?? ""} onChange={(event) => updateTerm("startDate", event.target.value)} /></label>
            <label className="fw-field">{t("add.f.hours")}<input name="hoursPerWeek" type="number" min="0.25" step="0.25" value={terms.hoursPerWeek ?? ""} onChange={(event) => updateTerm("hoursPerWeek", event.target.value)} /></label>
            <label className="fw-field">{t("add.f.responsibilities")}<textarea name="responsibilities" maxLength={500} value={terms.responsibilities ?? ""} onChange={(event) => updateTerm("responsibilities", event.target.value)} /></label>
            <label className="fw-field">{t("add.f.location")}<input name="location" value={terms.location ?? ""} onChange={(event) => updateTerm("location", event.target.value)} /></label>
            <label className="fw-field">{t("add.f.overtime")}<input name="overtime" value={terms.overtime ?? ""} onChange={(event) => updateTerm("overtime", event.target.value)} /></label>
            <label className="fw-field">{t("add.f.paymentDate")}<input name="paymentDate" value={terms.paymentDate ?? ""} onChange={(event) => updateTerm("paymentDate", event.target.value)} /></label>
            <label className="fw-field">{t("add.f.safety")}<input name="safety" value={terms.safety ?? ""} onChange={(event) => updateTerm("safety", event.target.value)} /></label>
            {(["benefits", "employmentType", "probation", "notice", "deductions", "contractConditions", "payPeriod", "taxBasis", "schedule", "leave", "contractDuration", "trainingDeposit", "documentRetention", "employerName"] as const).map(field => <label className="fw-field" key={field}>{t("add.optional", { label: t(`add.o.${field}` as MessageKey) })}<textarea name={field} maxLength={500} value={terms[field] ?? ""} onChange={event => updateTerm(field, event.target.value)} /></label>)}
          </section>
          <DraftOfferAssessment terms={terms} />
          <section className="fw-card fw-offer-detail-card">
            <strong>{t("add.participants")}</strong>
            {!offer && role === "WORKER" && <p className="fw-notice">{t("add.privateDraft")}</p>}
            <label className="fw-field">{t("add.partyRole")}
              <select value={role} disabled={Boolean(offer)} onChange={(event) => {
                const nextRole = event.target.value as Role;
                setRole(nextRole);
                setWorkerId(nextRole === "WORKER" ? profile?.id ?? "" : "");
              }}>
                <option value="WORKER">{t("add.roleWorker")}</option>
                <option value="EMPLOYER">{t("add.roleEmployer")}</option>
              </select>
            </label>
            {offer ? <label className="fw-field">{t("add.companyId")}<input name="companyId" readOnly value={offer.companyId} /></label> : <OfferCompanySelector value={companyId} onChange={setCompanyId} />}
            <label className="fw-field">{t("add.workerId")}<input name="workerId" required readOnly={role === "WORKER" || Boolean(offer)} pattern={"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"} title={t("add.workerIdTitle")} value={offer?.workerId ?? (role === "WORKER" ? profile?.id ?? "" : workerId)} onChange={(event) => setWorkerId(event.target.value)} /></label>
            <p className="fw-notice">{role === "WORKER" ? t("add.workerNote") : t("add.employerNote")}</p>
            <p className="fw-notice">{t("add.idsNote")}</p>
          </section>
          <p className="fw-disclaimer">{t("add.analyzeNote")}</p>
          <div className="fw-fixed-action">
            <button className="fw-primary" type="submit" disabled={busy}>{busy ? t("add.checking") : t("add.analyze")} <Icon name="arrow" size={18} /></button>
          </div>
        </form>
      )}
    </>
  );
}

function AnalyzingScreen() {
  const { t } = useI18n();
  const { offer } = useProduct();
  const terms = Object.fromEntries(Object.entries(offer?.snapshot ?? {}).map(([key, value]) => [key, String(value)]));
  const termRows = Object.entries(terms).slice(0, 6);
  return (
    <section aria-live="polite">
      <div className="fw-analysis-mark" aria-hidden="true"><span>···</span></div>
      <h2 className="fw-analysis-title">{t("check.analyzingTitle", { count: termRows.length || 0 })}</h2>
      <p className="fw-page-subtitle fw-analysis-copy">{t("check.analyzingCopy")}</p>
      <div className="fw-analysis-list">
        {termRows.map(([field, value], index) => {
          const unresolved = offer?.unresolved.some((question) => question.field === field);
          return <div className="fw-analysis-row" key={field}>
            <span className={`fw-analysis-dot${unresolved ? " warning" : ""}`} />
            <span><small>{labelFor(field, t)}</small><strong>{String(value)}</strong></span>
            <span className={`fw-analysis-state${unresolved ? " warning" : ""}`}>{unresolved ? t("check.clarify") : t("check.included")}</span>
            <span className="fw-screen-reader">{t("check.detailN", { n: index + 1 })}</span>
          </div>;
        })}
        {offer?.unresolved.filter((question) => !(question.field in terms)).map((question) => <div className="fw-analysis-row" key={question.id}>
          <span className="fw-analysis-dot warning" /><span><small>{labelFor(question.field, t)}</small><strong>{t("check.notStated")}</strong></span><span className="fw-analysis-state warning">{t("check.clarify")}</span>
        </div>)}
        {!termRows.length && <p className="fw-disclaimer">{t("check.noDetails")}</p>}
      </div>
      <div className="fw-analysis-meta">{t("check.revisionMeta", { version: offer?.version ?? "—" })}</div>
      <div className="fw-fixed-action"><Link className="fw-primary" href={routeFor("check")}>{t("check.seeCheck")} <Icon name="arrow" size={18} /></Link></div>
    </section>
  );
}

function CheckScreen() {
  const { t } = useI18n();
  const { offer } = useProduct();
  const terms = Object.fromEntries(Object.entries(offer?.snapshot ?? {}).map(([key, value]) => [key, String(value)]));
  if (!offer) {
    return <>
      <section className="fw-card fw-check-empty">
        <span className="fw-check-ring"><Icon name="shield" size={27} /></span>
        <strong>{t("check.noOffer")}</strong>
        <p>{t("check.noOfferBody")}</p>
        <Link href={routeFor("add-offer")} className="fw-primary">{t("check.addOffer")}</Link>
      </section>
    </>;
  }
  const missing = offer?.unresolved ?? [];
  const requiredFields = ["salary", "currency", "startDate", "hoursPerWeek", "responsibilities"] as const;
  const missingFields = new Set(missing.map((item) => item.field));
  const statedCount = requiredFields.filter((field) => Boolean(terms[field]?.trim()) && !missingFields.has(field)).length;
  const entries = Object.entries(terms);
  const missingCount = missing.length;
  return (
    <>
      <section className="fw-card fw-check-summary">
        <span className="fw-check-ring fw-check-count">{statedCount}<small>/{requiredFields.length}</small></span>
        <span><strong>{missingCount ? t("check.someClarify") : t("check.requiredStated")}</strong><br /><span className="fw-offer-employer">{t("check.statedCount", { stated: statedCount, total: requiredFields.length, missing: missingCount })}</span><span className="fw-check-basis">{t("check.basis")}</span></span>
      </section>
      <div className="fw-check-details" aria-label={t("check.completenessAria")}>
        {entries.map(([key, value]) => (
          <div className="fw-check-row" key={key}>
            <span className="fw-check-label">{labelFor(key, t)}</span>
            <span className={`fw-check-status${missingFields.has(key) ? " warning" : ""}`}>{missingFields.has(key) ? t("check.needsClarification") : t("check.stated")}</span>
            <div className="bar"><span className={missingFields.has(key) ? "warning" : ""} style={{ width: missingFields.has(key) ? "58%" : "100%" }} /></div>
            <span className="fw-check-value">{String(value)}</span>
          </div>
        ))}
      </div>
      {/* The rules read English field names from this text, so it is deliberately not translated. */}
      <RuleAnalysis text={Object.entries(terms).map(([key, value]) => `${labelFor(key)}: ${value}`).join("\n")} />
      <section className="fw-list-card" aria-label={t("sum.button")}>
        <p>{t("sum.note")}</p>
        <button type="button" className="fw-secondary" onClick={() => {
          const text = buildOfferSummary({ version: offer.version, termHash: offer.termHash, snapshot: offer.snapshot ?? {}, unresolved: offer.unresolved.map(item => ({ field: item.field, question: item.question })), generatedAt: new Date() }, t, field => labelFor(field, t));
          const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" })), link = document.createElement("a");
          link.href = url; link.download = `oryqen-offer-summary-revision-${offer.version}.md`; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
        }}>{t("sum.button")}</button>
      </section>
      <OfferPreparation key={`prep:${offer.offerId}:${offer.version}`} snapshot={offer.snapshot ?? {}} />
      <OfferNotes key={offer.offerId} offerId={offer.offerId} />
      <OfferAssessment key={`${offer.offerId}:${offer.version}:${offer.termHash}`} offerId={offer.offerId} version={offer.version} termHash={offer.termHash} hoursPerWeek={offer.snapshot?.hoursPerWeek} />
      <RecruiterVerification defaultEmployer={terms.employer ?? terms.company ?? ""} defaultRole={terms.jobTitle ?? terms.role ?? ""} />
      {missing.length ? (
        <section aria-label={t("check.needsClarification")}>
          <p className="fw-check-explainer">{t("check.foundFew")}</p>
          {missing.map((question) => <Link href={routeFor("questions")} key={question.id} className="fw-question-card fw-check-question fw-question-link"><strong>{labelFor(question.field, t)}</strong><p>{question.question}</p><span className="fw-question-badge">{t("check.needsClarification")}</span></Link>)}
        </section>
      ) : <p className="fw-success">{t("check.noQuestions")}</p>}
      {offer?.changes.length ? (
        <section className="fw-list-card"><strong>{t("check.changes")}</strong>{offer.changes.map((change) => <div className="fw-list-row" key={change.field}><span>{labelFor(change.field, t)}</span><strong>{change.previous ?? "—"} → {change.current ?? "—"}</strong></div>)}</section>
      ) : null}
      <div className="fw-fixed-action"><Link className="fw-primary" href={routeFor(missing.length ? "questions" : "agreement")}>{missing.length ? t("check.questionsToAsk") : t("check.reviewAgreement")} <Icon name="arrow" size={18} /></Link></div>
    </>
  );
}

function QuestionsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { offer, answered, loadAgreement, savedAnswers, profile } = useProduct();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const keys = useRef(new Map<string, string>());
  const questions = offer?.unresolved ?? [];

  async function copyQuestions() {
    try {
      await navigator.clipboard.writeText(questions.map((question) => question.question).join("\n"));
      setCopyStatus(t("ask.copied"));
    } catch {
      setCopyStatus(t("ask.copyFailed"));
    }
  }

  async function save(question: FieldQuestion) {
    if (!offer || !values[question.id]?.trim()) return;
    setBusy(true);
    setError(null);
    const input = {
      offerId: offer.offerId,
      offerVersion: offer.version,
      questionId: question.id,
      answer: values[question.id]!.trim(),
    };
    const fingerprint = JSON.stringify(input);
    let key = keys.current.get(fingerprint);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(fingerprint, key);
    }
    try {
      await appRequest("/api/v1/offers/answers", { ...input, idempotencyKey: key });
      // Recover the authoritative answer and attribution, including on retry.
      await loadAgreement(offer.offerId);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("The answer could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="fw-page-title">{t("ask.title")}</h2>
      <p className="fw-page-subtitle">{t("ask.subtitle", { version: offer?.version ?? "—" })}</p>
      {!questions.length && <p className="fw-notice">{t("ask.none")}</p>}
      {questions.map((question) => (
        <article className="fw-question-card" key={question.id}>
          <span className="fw-question-category">{labelFor(question.field, t).toUpperCase()}</span>
          <h3 style={{ margin: "5px 0", fontSize: 14 }}>{question.question}</h3>
          {answered.has(question.id) ? (
            <><p className="fw-success">{t("ask.saved")}</p>
              <p>{savedAnswers.find((answer) => answer.questionId === question.id)?.answer}</p></>
          ) : (
            <>
              <label className="fw-screen-reader" htmlFor={`answer-${question.id}`}>{t("ask.answerLabel", { question: question.question })}</label>
              <textarea
                id={`answer-${question.id}`}
                className="fw-field"
                style={{ width: "100%", boxSizing: "border-box", minHeight: 78 }}
                value={values[question.id] ?? ""}
                maxLength={2000}
                onChange={(event) => setValues({ ...values, [question.id]: event.target.value })}
                placeholder={t("ask.placeholder")}
              />
              <button type="button" className="fw-secondary" disabled={busy || !values[question.id]?.trim()} onClick={() => void save(question)}>{t("ask.save")}</button>
            </>
          )}
        </article>
      ))}
      <p className="fw-notice">{t("ask.immutable")}</p>
      <ErrorMessage error={error} />
      {copyStatus && <p role="status" className="fw-notice">{copyStatus}</p>}
      <div className="fw-fixed-action fw-question-actions">
        {questions.length > 0 && <button type="button" className="fw-secondary" onClick={() => void copyQuestions()}>{t("ask.copy")}</button>}
        <button type="button" className="fw-dark-button" disabled={!offer || questions.some((question) => question.required && !answered.has(question.id))} onClick={() => router.push(routeFor("agreement"))}>{t("ask.continue")} <Icon name="arrow" size={18} /></button>
      </div>
      <span className="fw-screen-reader">{t("ask.signedIn", { id: profile?.id ?? "" })}</span>
    </>
  );
}

function AgreementScreen() {
  const { offer, role, setRole, agreement, setAgreement, loadAgreement, savedAnswers, answered, profile } = useProduct();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestKeys = useRef(new Map<string, string>());
  const router = useRouter();

  async function confirm() {
    if (!offer?.snapshot || !offer.representativeId) return;
    setBusy(true);
    setError(null);
    try {
      // Resolve the common agreement ID and recheck the exact displayed revision.
      // Do not silently replace the terms the person is about to confirm.
      const saved = agreementReadSchema.parse(await appRequest(`/api/v1/agreements?offerId=${offer.offerId}`));
      if (saved.offer.version !== offer.version || saved.offer.termHash !== offer.termHash) throw new ApiRequestError("VERSION_CONFLICT", 409);
      if (saved.confirmation) { setAgreement(saved.confirmation); return; }
      if (!saved.canConfirm) throw new ApiRequestError("ACTION_FORBIDDEN", 403);
      const input = {
        agreementId: saved.agreementId,
        offerId: offer.offerId,
        companyId: offer.companyId,
        workerId: offer.workerId,
        confirmationRole: role,
        expectedVersion: offer.version,
      };
      const fingerprint = JSON.stringify(input);
      let key = requestKeys.current.get(fingerprint);
      if (!key) {
        key = crypto.randomUUID();
        requestKeys.current.set(fingerprint, key);
      }
      const result = await appRequest("/api/v1/agreements", { ...input, idempotencyKey: key }) as AgreementResult;
      setAgreement(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("Agreement confirmation failed."));
    } finally {
      setBusy(false);
    }
  }

  if (!offer) {
    return (
      <>
        <h2 className="fw-page-title">Agreement summary</h2>
        <section className="fw-card fw-check-empty">
          <span className="fw-check-ring"><Icon name="check" size={27} /></span>
          <strong>No offer revision is available.</strong>
          <p>Add an offer or open an existing participant record below.</p>
          <Link href={routeFor("add-offer")} className="fw-primary">Add offer</Link>
        </section>
        <OpenSavedAgreement />
      </>
    );
  }

  const unresolved = offer.unresolved;
  const terms = offer.snapshot ?? {};
  const canConfirm = Boolean(offer.snapshot && offer.representativeId)
    && !unresolved.some((question) => question.required && !answered.has(question.id));
  return (
    <>
      <h2 className="fw-page-title" style={{ marginTop: 0 }}>Agreement summary</h2>
      <p className="fw-page-subtitle">Offer revision {offer.version} · Employer authority is checked by the server.</p>
      <OfferHistoryPanel key={offer.offerId} offerId={offer.offerId} />
      {profile?.id === offer.workerId && <CreateVersionedAgreement offerId={offer.offerId} version={offer.version} termHash={offer.termHash} representativeId={offer.representativeId} />}
      {!offer.snapshot && <p className="fw-notice">Saved terms are unavailable. Submit the offer again before confirming.</p>}
      {offer.representativeId === null && <p className="fw-notice">This worker-created review has no designated employer representative. It cannot become an agreement through the current workflow.</p>}
      <section className="fw-term-card" aria-label="Offer terms for agreement">
        {Object.entries(terms).map(([key, value]) => (
          <div className="fw-term-row" key={key}><span>{labelFor(key)}</span><strong>{String(value ?? "Not stated")}</strong><span className={`fw-state-dot${value ? "" : " muted"}`} /></div>
        ))}
        <div className="fw-term-row"><span>Questions</span><strong>{unresolved.length ? `${unresolved.length} attached` : "None required"}</strong><span className={`fw-state-dot${unresolved.length ? " muted" : ""}`} /></div>
      </section>
      {unresolved.length > 0 && <section className="fw-list-card"><strong>Unresolved items in this revision</strong>{unresolved.map((question) => <div className="fw-list-row" key={question.id}><span>{labelFor(question.field)}</span><strong>{question.question}</strong></div>)}</section>}
      {unresolved.some((question) => question.required && !answered.has(question.id)) && <p className="fw-notice">Save the required clarification answers before confirming. <Link href={routeFor("questions")}>Review questions</Link></p>}
      {savedAnswers.length > 0 && <section className="fw-list-card"><strong>Saved clarification answers</strong>{savedAnswers.map((answer) => <div className="fw-list-row" key={answer.questionId}><span>{unresolved.find((question) => question.id === answer.questionId)?.question}<br />Recorded by {answer.answeredBy === profile?.id ? "you" : answer.answeredBy === offer.workerId ? "the worker" : "the employer representative"}</span><strong>{answer.answer}</strong></div>)}</section>}
      <div className="fw-notice">The database creates the authoritative agreement hash from these exact terms and unresolved items. A confirmation does not change either.</div>
      {!agreement ? (
        <>
          <label className="fw-field">Confirm as
            <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option value="WORKER">Worker</option>
              <option value="EMPLOYER">Employer representative</option>
            </select>
          </label>
          <div className="fw-signatures">
            <div className="fw-signature"><span className="fw-signature-avatar" aria-hidden="true">W</span><span><strong>Worker</strong><br />Awaiting independent confirmation</span></div>
            <div className="fw-signature"><span className="fw-signature-avatar" aria-hidden="true">E</span><span><strong>Employer</strong><br />Authority checked at confirmation</span></div>
          </div>
          <ErrorMessage error={error} />
          <div className="fw-fixed-action"><button type="button" className="fw-primary" disabled={busy || !canConfirm} onClick={() => void confirm()}>{busy ? "Saving confirmation…" : "Confirm these terms"} <Icon name="arrow" size={18} /></button></div>
        </>
      ) : (
        <>
          <div className={agreement.status === "confirmed" ? "fw-success" : "fw-notice"} role="status">
            {agreement.status === "confirmed" ? "Both parties confirmed this agreement revision." : `Your ${agreement.confirmationRole.toLowerCase()} confirmation was recorded. The other independent party must sign in and confirm.`}
          </div>
          <section className="fw-signatures">
            <div className="fw-signature"><strong>{agreement.confirmationRole === "WORKER" ? "Worker" : "Employer"}</strong><br />Confirmation recorded</div>
            <div className="fw-signature"><strong>Other party</strong><br />{agreement.status === "confirmed" ? "Confirmed" : "Not yet confirmed"}</div>
          </section>
          <div className="fw-demo-preview">
            Use the participant link below in the other person's independent session. Reload to see their saved confirmation.
          </div>
          <div className="fw-fixed-action"><button type="button" className="fw-dark-button" disabled={agreement.status !== "confirmed"} onClick={() => router.push(routeFor("work-record"))}>Start work record <Icon name="arrow" size={18} /></button></div>
        </>
      )}
      <section className="fw-card fw-offer-detail-card">
        <label className="fw-field">Participant link<input readOnly value={`/app/agreement?offerId=${offer.offerId}`} onFocus={(event) => event.target.select()} /></label>
        <p className="fw-notice">Send this path on the same ORYQEN site to the designated participant. They must sign in with their own account. The link grants no access.</p>
        <button type="button" className="fw-secondary" onClick={() => void loadAgreement(offer.offerId)}>Reload saved agreement</button>
      </section>
    </>
  );
}

function PreviewScreen({ screen, profile, demoPreview = false }: { screen: string; profile: Profile | null; demoPreview?: boolean }) {
  if (screen === "work-record") {
    if (demoPreview) {
      const week = [
        ["Mon", "22", "8 h", "confirmed"],
        ["Tue", "23", "8 h", "confirmed"],
        ["Wed", "24", "8.5 h", "confirmed"],
        ["Thu", "25", "8 h", "confirmed"],
        ["Fri", "26", "8 h", "sample"],
      ];
      return (
        <div className="fw-demo-work">
          <section className="fw-progress-card fw-work-summary fw-demo-week-summary">
            <span className="fw-eyebrow">THIS WEEK · DEMO SAMPLE</span>
            <div><strong>40.5 hrs</strong><span>of 40 agreed</span></div>
          </section>
          <section className="fw-demo-week-card" aria-label="Sample weekly work record">
            {week.map(([day, date, hours, status]) => (
              <div className="fw-demo-day" key={day}>
                <span className="fw-demo-day-label"><strong>{day}</strong><small>{date}</small></span>
                <span className={`fw-demo-hours-bar${status === "sample" ? " is-sample" : ""}`}><i /></span>
                <strong className="fw-demo-hours">{hours}</strong>
                <span className={`fw-demo-day-status${status === "sample" ? " is-sample" : ""}`} aria-label={status === "sample" ? "Demo sample, not verified" : "Figma sample, not verified"}>{status === "sample" ? "···" : "✓"}</span>
              </div>
            ))}
          </section>
          <button className="fw-primary" type="button" disabled>Log today · 8h</button>
          <p className="fw-demo-work-note">Figma preview only. Hours are not real or confirmed by an employer.</p>
          <Link className="fw-dark-button" href={previewRouteFor("passport", true)}>View Work Passport <Icon name="arrow" size={18} /></Link>
        </div>
      );
    }
    return (
      <>
        <div className="fw-progress-card fw-work-summary fw-work-summary-empty">
          <span className="fw-eyebrow">THIS WEEK</span>
          <h2>No hours connected</h2>
          <span>Work records are unavailable for this account.</span>
        </div>
        <section className="fw-work-empty-card fw-work-empty-compact" aria-label="Work records unavailable">
          <p className="fw-work-empty-heading">Weekly work record</p>
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
            <div className="fw-empty-day" key={day}><strong>{day}</strong><span /><small>Unavailable</small></div>
          ))}
          <p className="fw-work-empty-copy">No work-hour data is available in this account view.</p>
        </section>
        <button className="fw-primary" type="button" disabled aria-describedby="work-record-status">Log today</button>
        <p id="work-record-status" className="fw-disclaimer">Logging and employer confirmation are not connected. No hours have been created.</p>
        <Link className="fw-dark-button fw-record-passport-link" href={routeFor("passport")}>View Work Passport <Icon name="arrow" size={18} /></Link>
      </>
    );
  }
  if (screen === "passport") {
    if (demoPreview) {
      return (
        <div className="fw-demo-passport">
          <section className="fw-progress-card fw-passport-card fw-demo-passport-card">
            <div className="fw-passport-person">
              <span className="fw-avatar">N</span>
              <span><strong>Nimal Perera</strong><br /><span>Work Passport</span></span>
            </div>
            <p className="fw-demo-role">Motorcycle Technician · Kurunegala</p>
            <div className="fw-demo-passport-meta"><span>SAMPLE ONLY</span><span>73% sample progress</span></div>
            <div className="fw-demo-progress-track"><span /></div>
          </section>
          <h3 className="fw-section-label">Skills</h3>
          <div className="fw-demo-skill-list">
            {["Motorcycle maintenance", "Brake servicing", "Engine diagnostics"].map((skill) => (
              <div className="fw-demo-skill" key={skill}><Icon name="check" size={15} /><strong>{skill}</strong><span>AutoCare Garage</span></div>
            ))}
          </div>
          <h3 className="fw-section-label">Previous role</h3>
          <div className="fw-demo-previous-role"><strong>Apprentice · 3 mo · Sample</strong><span>Figma preview only · Not employer verified</span></div>
          <div className="fw-demo-passport-action"><Link className="fw-primary" href={previewRouteFor("share", true)}>Share Work Passport</Link></div>
        </div>
      );
    }
    return (
      <>
        <section className="fw-progress-card fw-passport-card fw-passport-card-empty">
          <div className="fw-passport-person">
            <span className="fw-avatar">{profile?.displayName?.slice(0, 1) ?? "?"}</span>
            <span><strong>{profile?.displayName ?? "Your account"}</strong><br /><span>Work Passport</span></span>
          </div>
          <p className="fw-passport-empty-status"><Icon name="badge" size={20} />Evidence is not connected for this account.</p>
        </section>
        <h3 className="fw-section-label">Skills</h3>
        <div className="fw-list-card fw-empty-list">No verified skills are available through the current service.</div>
        <h3 className="fw-section-label">Previous roles</h3>
        <div className="fw-list-card fw-empty-list">Work history is not connected to this account view.</div>
        <p className="fw-disclaimer">No evidence, role, or verification status is fabricated.</p>
        <div className="fw-fixed-action"><Link className="fw-primary" href={routeFor("share")}>Share Work Passport</Link></div>
      </>
    );
  }
  return (
    <>
      <header className="fw-employer-top">
        <Link className="fw-back" href={routeFor("settings")} aria-label="Back to settings"><Icon name="back" /></Link>
        <span className="fw-pill fw-employer-pill">EMPLOYER VIEW</span>
      </header>
      <div className="fw-employer-heading">
        <div className="fw-company-heading">
          <span className="fw-company-mark">?</span>
          <span><strong>Company workspace</strong><br /><small>Company and membership information unavailable</small></span>
        </div>
      </div>
      <section className="fw-card fw-employer-card">
        <div className="fw-employer-card-title"><span><strong>Offer clarity</strong><br /><small>No company offer data is connected.</small></span><span className="fw-score-placeholder">—</span></div>
        {["Overtime rate", "Payment date"].map((item) => <div className="fw-list-row" key={item}><span>{item}</span><button className="fw-small-action" disabled aria-label={`${item} details unavailable`}>Unavailable</button></div>)}
      </section>
      <section className="fw-card fw-employer-card">
        <strong>Hours to confirm</strong>
        <p className="fw-offer-employer">No hours are available for confirmation.</p>
        <button className="fw-small-action" disabled>Confirm</button>
        <p className="fw-disclaimer">Employer membership and work-hour confirmation are enforced by the server and are not connected to this screen.</p>
      </section>
      <section className="fw-card fw-employer-new-offer"><span><strong>Post a new offer</strong><br /><small>Continue to secure offer entry</small></span><Link className="fw-small-action" href={routeFor("add-offer")}>+ New</Link></section>
    </>
  );
}

function SettingsScreen({ profile }: { profile: Profile | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const { setProfile } = useProduct();
  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await appRequest("/api/v1/auth/sign-out", {});
      try { window.sessionStorage.removeItem("fairwork.offer-selection"); } catch { /* Optional non-secret navigation state. */ }
      router.replace("/sign-in");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(t("set.signOutFail")));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ProductHeader screen="settings" title="" />
      <h2 className="fw-page-title">{t("settings.title")}</h2><p className="fw-page-subtitle">{t("settings.subtitle")}</p>
      <section className="fw-profile-card"><span className="fw-avatar">{profile?.displayName?.slice(0, 1) ?? "?"}</span><span><strong>{profile?.displayName ?? t("set.member")}</strong><br /><span className="fw-offer-employer">{t("set.signedIn")}</span></span></section>
      {profile && <ProfileEditor profile={profile} onSaved={setProfile} />}
      {profile && <section className="fw-list-card" aria-label={t("set.refAria")}><label className="fw-field">{t("set.refLabel")}<input readOnly value={profile.id} onFocus={event=>event.target.select()} /></label><p className="fw-disclaimer">{t("set.refNote")}</p></section>}
      <section className="fw-list-card">
        {(["set.jobAlerts", "set.hoursReminders"] as const).map(label => <div className="fw-list-row" key={label}><span>{t(label)}</span><small>{t("set.notAvailable")}</small></div>)}
      </section>
      <LanguageSwitcher />
      <PlanPanel />
      <p className="fw-disclaimer">{t("set.inAppNote")}</p>
      <details className="fw-list-card"><summary>{t("export.title")}</summary><DataExportPanel /></details>
      <details className="fw-list-card"><summary>{t("rt.title")}</summary><RetentionPanel /></details>
      <details className="fw-list-card"><summary>{t("set.privacy")}</summary><PrivacyRequests /></details>
      <details className="fw-list-card"><summary>{t("rp.mine")}</summary><MyReports /></details>
      <details className="fw-list-card"><summary>{t("set.developer")}</summary><DeveloperAccess /></details>
      {profile && <details className="fw-list-card"><summary>{t("set.security")}</summary><AccountSecurity revision={profile.revision} /></details>}
      <Link className="fw-secondary" href="/forgot-password">{t("set.resetPassword")}</Link>
      {profile?.capabilities.includes("authority_operator") && <details className="fw-list-card"><summary>{t("set.assignPlans")}</summary><PlanAssignment /></details>}
      {profile?.capabilities.includes("authority_operator") && <details className="fw-list-card"><summary>Assign organization plans (operator)</summary><OrgPlanAssignment /></details>}
      {profile?.capabilities.includes("review_operator") && <details className="fw-list-card"><summary>Review reports (reviewer)</summary><ReportQueue /></details>}
      {profile?.capabilities.includes("privacy_operator") && <details className="fw-list-card"><summary>{t("set.reviewPrivacy")}</summary><PrivacyRequests operator /></details>}
      <Link className="fw-dark-button" href={routeFor("employer")}>{t("set.employerView")}</Link>
      <Link className="fw-secondary" href={routeFor("cases")}>{t("set.caseReview")}</Link>
      <button className="fw-secondary" style={{ marginTop: 12 }} disabled={busy} onClick={() => void signOut()}>{busy ? t("set.signingOut") : t("set.signOut")}</button>
      <ErrorMessage error={error} />
    </>
  );
}

function NotificationsScreen() {
  return (
    <>
      <ProductHeader screen="notifications" title="" />
      <h2 className="fw-page-title">Notifications</h2><NotificationFeed />
    </>
  );
}

function ShareSheet() {
  const router = useRouter();
  const dragStart = useRef<number | null>(null);
  const close = useCallback(() => router.push(routeFor("passport")), [router]);
  useEffect(() => {
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", dismissOnEscape);
    return () => window.removeEventListener("keydown", dismissOnEscape);
  }, [close]);
  return (
    <div className="fw-share-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="fw-share-sheet" style={{maxHeight:"90dvh",overflowY:"auto"}} role="dialog" aria-modal="true" aria-labelledby="share-heading">
        <AppBrandHeader />
        <button className="fw-share-handle" aria-label="Close share options" onPointerDown={(event) => { dragStart.current = event.clientY; }} onPointerUp={(event) => { if (dragStart.current !== null && event.clientY - dragStart.current > 60) close(); dragStart.current = null; }} onClick={close}><span /></button>
        <h2 id="share-heading" style={{ fontSize: 19 }}>Share your passport</h2>
        <p className="fw-page-subtitle">You choose what employers can see.</p>
        <PassportSharing />
      </section>
    </div>
  );
}

const FIELD_KEY: Record<string, MessageKey> = {
  salary: "field.salary", currency: "field.currency", startDate: "field.startDate", hoursPerWeek: "field.hoursPerWeek", responsibilities: "field.responsibilities",
  role: "field.role", location: "field.location", overtime: "field.overtime", paymentDate: "field.paymentDate", safety: "field.safety",
  benefits: "add.o.benefits", employmentType: "add.o.employmentType", probation: "add.o.probation", notice: "add.o.notice", deductions: "add.o.deductions",
  contractConditions: "add.o.contractConditions", payPeriod: "add.o.payPeriod", taxBasis: "add.o.taxBasis", schedule: "add.o.schedule", leave: "add.o.leave",
  contractDuration: "add.o.contractDuration", trainingDeposit: "add.o.trainingDeposit", documentRetention: "add.o.documentRetention", employerName: "add.o.employerName",
};
const ENGLISH_LABELS: Record<string, string> = { salary: "Pay", currency: "Currency", startDate: "Start date", hoursPerWeek: "Working hours", responsibilities: "Role details", role: "Role", location: "Location", overtime: "Overtime", paymentDate: "Payment date", safety: "Safety" };
function labelFor(field: string, t?: (key: MessageKey) => string) {
  const key = FIELD_KEY[field];
  if (t && key) return t(key);
  return ENGLISH_LABELS[field] ?? field.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export function IntroScreen({ screen, initialSlide = 0 }: { screen: "splash" | "language" | "onboarding" | "welcome"; initialSlide?: number }) {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const [slide, setSlide] = useState(initialSlide);
  useEffect(() => {
    if (screen !== "splash") return;
    const timer = window.setTimeout(() => router.replace("/intro/onboarding"), 1800);
    return () => window.clearTimeout(timer);
  }, [router, screen]);
  const slides = [
    ["See what’s clear", "Check any job offer in seconds.", "We show what is stated and what is missing."],
    ["Ask with confidence", "Get simple, polite questions about", "overtime, pay dates and more."],
    ["Build your Work Passport", "Every verified job and skill becomes", "proof you can carry to your next role."],
  ];

  if (screen === "splash") {
    return <main id="main" tabIndex={-1} className="fw-intro fw-splash">
      <a className="fw-skip-link" href="#main">Skip to content</a>
      <div className="fw-intro-status"><span>9:41</span><span className="fw-device-icons"><span className="fw-signal" /><span className="fw-battery" /></span></div>
      <section className="fw-intro-hero">
        <BrandLogo className="oq-brand-splash" existing={<><div className="fw-intro-logo"><Image src="/figma/product/00-splash-icon.svg" width={88.08} height={88.08} alt="" unoptimized /></div><h1>ORYQEN</h1></>} />
        <p>Know what’s clear before you accept.</p>
        <div className="fw-progress-dots" aria-label="Starting ORYQEN"><span className="active" /><span className="active" /><span className="active" /></div>
      </section>
    </main>;
  }

  if (screen === "language") {
    return <main id="main" className="fw-intro fw-language-screen"><DeviceStatus /><AppBrandHeader prominent /><Link className="fw-back fw-intro-back" href="/intro/onboarding?slide=3" aria-label="Back"><Icon name="back" /></Link><section className="fw-language-content"><h1>{t("language.heading")}</h1><p className="fw-language-native">භාෂාව තෝරන්න · மொழியைத் தேர்ந்தெடுக்கவும் · Sprache wählen</p>{LOCALES.map((item, index) => <button className={`fw-language-option${locale === item.code ? " selected" : ""}`} key={item.code} aria-pressed={locale === item.code} onClick={() => setLocale(item.code)}><span className="fw-language-bubble">{["EN", "සි", "த", "DE"][index]}</span>{item.native}{item.native !== item.english ? ` ${item.english}` : ""}{item.status === "preview" ? " (preview)" : ""}<span className={`fw-radio${locale === item.code ? " selected" : ""}`} /></button>)}{locale !== "en" && <p role="status" className="fw-language-unavailable">{t("language.selected", { language: LOCALES.find(item => item.code === locale)!.native })}</p>}</section><div className="fw-intro-bottom"><Link href="/welcome" className="fw-primary">{t("language.continue")}</Link></div></main>;
  }

  if (screen === "onboarding") {
    const [title, description, secondLine] = slides[slide]!;
    return <main id="main" className="fw-intro fw-onboarding-screen">
      <DeviceStatus /><AppBrandHeader prominent /><button className="fw-intro-skip" onClick={() => router.push("/intro/language")}>Skip</button>
      <section className="fw-onboarding-hero">
        <div className="fw-onboarding-art fw-slide-enter" key={`art-${slide}`}><div className="fw-onboarding-art-icon"><Image src={`/figma/product/00-onboarding-${slide + 1}-icon.svg`} width={108} height={108} alt="" unoptimized /></div></div>
        <div key={`copy-${slide}`} className="fw-onboarding-copy fw-slide-enter">
          <h1>{title}</h1><p>{description}{" "}<br />{secondLine}</p>
          <div className="fw-progress-dots" aria-label={`Slide ${slide + 1} of 3`}>{slides.map((_, index) => <span className={index === slide ? "active" : ""} key={index} />)}</div>
        </div>
      </section>
      <button className="fw-primary" onClick={() => slide < 2 ? setSlide(slide + 1) : router.push("/intro/language")}>{slide === 2 ? "Get started" : "Next"}</button>
    </main>;
  }

  return <SignInScreen />;
}

export function OtpScreen() {
  const router = useRouter();
  const [factor, setFactor] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const code = digits.join("");

  useEffect(() => {
    appRequest("/api/v1/auth/mfa")
      .then((result: { factors: Array<{ id: string; status: string }> }) => {
        const verified = result.factors.find((item) => item.status === "verified");
        if (!verified) throw new Error("No verified authenticator is enrolled.");
        setFactor(verified.id);
        setStatus("ready");
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught : new Error("Authenticator unavailable."));
        setStatus("unavailable");
      });
  }, []);

  function updateDigit(index: number, raw: string) {
    const nextDigit = raw.replace(/\D/g, "");
    if (nextDigit.length > 1) {
      const pasted = nextDigit.slice(0, 6).split("");
      setDigits(Array.from({ length: 6 }, (_, position) => pasted[position] ?? ""));
      inputs.current[Math.min(pasted.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = nextDigit.slice(-1);
    setDigits(next);
    if (nextDigit && index < 5) inputs.current[index + 1]?.focus();
  }

  function handleDigitKeyDown(index: number, event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      inputs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) inputs.current[index + 1]?.focus();
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await appRequest("/api/v1/auth/mfa", { action: "verify", factorId: factor, code });
      setDigits(["", "", "", "", "", ""]);
      router.replace("/operator/authority");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("Authenticator verification failed."));
    } finally {
      setBusy(false);
    }
  }

  return <main id="main" className="fw-intro fw-otp-screen">
    <AppBrandHeader prominent />
    <DeviceStatus /><Link className="fw-back fw-intro-back" href="/sign-in" aria-label="Back"><Icon name="back" /></Link>
    <h1>Verify your authenticator</h1>
    <p className="fw-otp-description">Six-digit code from your authenticator app.</p>
    {status === "loading" && <p role="status">Checking your verified factor…</p>}
    {status === "unavailable" && <ErrorMessage error={error} />}
    {status === "ready" && <form onSubmit={(event) => void verify(event)}>
      <fieldset className="fw-otp-fields" aria-label="Six-digit authenticator code">
        {digits.map((digit, index) => <input
          key={index}
          ref={(element) => { inputs.current[index] = element; }}
          aria-label={`Authenticator digit ${index + 1}`}
          value={digit}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => handleDigitKeyDown(index, event)}
          onPaste={(event) => {
            event.preventDefault();
            updateDigit(index, event.clipboardData.getData("text"));
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          pattern="[0-9]?"
          maxLength={6}
        />)}
      </fieldset>
      <button className="fw-primary" disabled={busy || code.length !== 6 || digits.some((digit) => !digit)}>{busy ? "Verifying…" : "Verify & continue"}</button>
    </form>}
    {error && status === "ready" && <ErrorMessage error={error} />}
    <div className="fw-otp-information"><p>Authenticator codes only. No SMS is sent.</p><AuthInformationLink /></div>
  </main>;
}
