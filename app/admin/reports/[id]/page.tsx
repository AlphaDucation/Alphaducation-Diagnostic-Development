import ReportEditor from "@/app/admin/report-editor";

export const dynamic = "force-dynamic";

type ReportPageProps = { params: Promise<{ id: string }> };

export default async function ReportPage({ params }: ReportPageProps) {
  return <ReportEditor attemptId={(await params).id} />;
}
