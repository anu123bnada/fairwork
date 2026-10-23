import Link from "next/link";
import type {AdminData} from "@/features/admin/schema";
import styles from "./admin.module.css";

const label=(value:string)=>value.replace(/([a-z])([A-Z])/g,"$1 $2").replaceAll("_"," ");
export function OperationsOverview({data}:{data:NonNullable<AdminData["overview"]>}) {
 const maximum=Math.max(1,...data.trends.map(day=>Math.max(day.agreements,day.workRecords)));
 return <>
  <section className={styles.panel} aria-label="Operational alerts">
   <h2>Queues requiring attention</h2>
   <p>Current database state across all dates. These are workflow queues, not automatic risk or fraud determinations.</p>
   <div className={styles.metrics}>{data.alerts.map(alert=><article key={alert.kind} className={styles.panel}>
    <Link href={alert.href}>{label(alert.kind)}</Link><strong>{alert.count.toLocaleString()}</strong><small>{alert.explanation}</small>
   </article>)}</div>
   <p>Organizations with representative access suspended: <strong>{data.suspendedOrganizations}</strong>. Historical agreements and verification decisions are retained.</p>
  </section>
  <section className={styles.panel} aria-label="Workflow trends">
   <h2>Agreement, Work Record and case activity</h2>
   <p>{data.window.from} through {data.window.to} · UTC · new records and recorded case resolutions</p>
   <div className={styles.chart} aria-hidden="true">{data.trends.map(day=><div key={day.date} title={`${day.date}: ${day.agreements} agreements, ${day.workRecords} Work Records`}>
    <i style={{height:`${Math.max(2,day.agreements/maximum*100)}%`}}/><b style={{height:`${Math.max(2,day.workRecords/maximum*100)}%`}}/>
   </div>)}</div><p>Cyan: agreements · Violet: Work Records</p>
   <details><summary>Daily workflow counts</summary><div className={styles.tableScroll}><table>
    <caption>Database records by UTC day</caption><thead><tr><th scope="col">Date</th><th scope="col">Agreements</th><th scope="col">Work Records</th><th scope="col">Cases opened</th><th scope="col">Cases resolved</th></tr></thead>
    <tbody>{data.trends.map(day=><tr key={day.date}><th scope="row">{day.date}</th><td>{day.agreements}</td><td>{day.workRecords}</td><td>{day.casesOpened}</td><td>{day.casesResolved}</td></tr>)}</tbody>
   </table></div></details>
  </section>
  <section className={styles.panel} aria-label="Recent operational activity">
   <h2>Recent operational activity</h2><p>Latest 20 entries in the selected UTC window. Metadata only; use each workspace for its authorized history.</p>
   {!data.activity.length?<p>No recorded activity in this date window.</p>:<div className={styles.tableScroll}><table>
    <thead><tr><th scope="col">Workspace</th><th scope="col">Record</th><th scope="col">State</th><th scope="col">Recorded (UTC)</th></tr></thead>
    <tbody>{data.activity.map(event=><tr key={`${event.kind}:${event.id}`}><td><Link href={`/admin/${event.kind}`}>{label(event.kind)}</Link></td><td>{event.label}<small>{event.id}</small></td><td>{label(event.status)}</td><td><time dateTime={event.recordedAt}>{event.recordedAt.slice(0,19).replace("T"," ")}</time></td></tr>)}</tbody>
   </table></div>}
  </section>
 </>;
}
