import { Dashboard } from "@/components/dashboard";
import { getScreenerData } from "@/lib/data";

export const revalidate = 3600;

export default async function HomePage() {
  const dataset = await getScreenerData();
  return <Dashboard dataset={dataset}/>;
}
