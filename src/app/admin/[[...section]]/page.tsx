import {notFound} from "next/navigation";
import {adminDefaultQuery,adminResource,adminResponse} from "@/features/admin/schema";
import {adminService,adminRuntime} from "@/server/admin";
import {AdminCenter,AdminAccess} from "@/components/admin/admin-center";
import {AppError} from "@/lib/errors";
import {z} from "zod";
export const dynamic="force-dynamic";
export default async function AdminPage({params,searchParams}:{params:Promise<{section?:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {section}=await params;if(section&&section.length>1)notFound();const resource=adminResource.safeParse(section?.[0]??"dashboard");if(!resource.success)notFound();
 const query=adminDefaultQuery(resource.data);
 if(resource.data==="audit"||resource.data==="telemetry"){
  const target=(await searchParams).target;
  if(target!==undefined){const parsed=z.uuid().safeParse(target);if(!parsed.success)notFound();query.search=parsed.data;}
 }
 let initial;let message="Administrative access is unavailable.";
 try{initial=adminResponse.parse(await adminService("admin_read",query,false));}
 catch(error){if(error instanceof AppError)message=error.message;}
 if(!initial)return <AdminAccess message={message}/>;
 return <AdminCenter key={`${resource.data}:${query.search}`} resource={resource.data} initial={initial} initialQuery={query} runtime={adminRuntime()}/>;
}
