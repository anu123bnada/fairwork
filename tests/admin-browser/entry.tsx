// Isolated component fixture. This file is outside Next routes and never shipped.
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/700.css";
import {createRoot} from "react-dom/client";
import {AdminCenter,AdminAccess} from "../../src/components/admin/admin-center";
import {CaseFollowups} from "../../src/components/fairwork/case-followups";
import {OrganizationRequests} from "../../src/components/fairwork/organization-requests";
import {adminDefaultQuery,adminResource,adminRole,type AdminData} from "../../src/features/admin/schema";
document.documentElement.style.setProperty("--font-manrope","Manrope");
const params=new URLSearchParams(location.search),resource=adminResource.parse(params.get("resource")??"dashboard"),role=adminRole.parse(params.get("role")??"owner");
const date="2026-10-20T00:00:00.000Z";
const fixtureId="50000000-0000-4000-8000-000000000001";
const data:AdminData={role,items:resource==="users"?[{id:"50000000-0000-4000-8000-000000000001",label:"Synthetic fixture profile",status:"active",revision:1,recordedAt:date,detail:{profileVerification:"authenticated_profile_not_external_identity"}}]:[],nextCursor:null,metrics:resource==="dashboard"?{users:23,offers:12,completedAnalyses:null}:null,trend:resource==="dashboard"?[{date:"2026-10-19",offers:4,registrations:3},{date:"2026-10-20",offers:8,registrations:2}]:null,dataMode:"synthetic"};
const runtime={provider:"gemini",model:null,liveProcessingConfigured:false,providerAvailability:"not_probed",providerCost:null,ruleBasedFallback:true,limits:{dailyPlatform:100,dailyAccount:10,minuteAccount:3},retentionPolicy:"approval_required",registrationEnabled:false,backend:"fixture_only",build:"0.1.0",release:"NO-GO",dataMode:"synthetic"} as const;
if(resource==="organizations")data.items=[{id:fixtureId,label:"Synthetic organization",status:"synthetic",revision:0,recordedAt:date,detail:{suspended:false,externallyVerified:false}}];
if(resource==="incidents")data.incidentCategories=["support","moderation"];
if(resource==="dashboard")data.overview={activity:[{id:fixtureId,label:"Fixture agreement",status:"draft",recordedAt:date,kind:"agreements"}],trends:[{date:"2026-10-20",agreements:2,workRecords:1,casesOpened:0,casesResolved:0}],alerts:[{kind:"organization_review",count:3,href:"/admin/requests",explanation:"Requests awaiting independent review"}],suspendedOrganizations:1,window:{from:"2026-10-20",to:"2026-10-20",timezone:"UTC"}};
if(resource==="telemetry")data.telemetry={coverageStartedAt:date,lastEventAt:date,aiAttempts:1,aiSucceeded:0,aiFailed:1,loginFailures:2,authorizationDenials:1,providerCost:null,availability:"observed_requests_only",scope:"selected_utc_window"};
createRoot(document.getElementById("root")!).render(params.has("orgrequests")?<OrganizationRequests operator={params.has("operator")}/>:params.has("followups")?<CaseFollowups caseId={fixtureId} revision={4} basePath="/app/cases"/>:params.has("denied")?<AdminAccess message="Administrative access is required."/>:<AdminCenter resource={resource} initial={data} initialQuery={{...adminDefaultQuery(resource),search:params.get("target")??""}} runtime={runtime}/>);
