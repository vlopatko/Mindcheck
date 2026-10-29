import DemoParserView from "@/components/demo-parser-view";

export default async function DemoReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DemoParserView initialReportId={id} reportOnly />;
}
