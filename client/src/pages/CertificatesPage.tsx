import SidebarNavigation from "@/components/SidebarNavigation";
import CertificatesDashboard from "./CertificatesDashboard";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export default function CertificatesPage() {
  const [, navigate] = useLocation();
  
  // Auth check
  const { data: adminUser, isLoading: authLoading } = trpc.admin.me.useQuery(undefined, {
    retry: false,
  });

  // Redirect if not authenticated
  if (!authLoading && !adminUser) {
    navigate("/admin/login");
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50/50 flex-col lg:flex-row">
      <SidebarNavigation />
      <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">إدارة طلبات الشهادات</h1>
            <p className="text-gray-500 mt-1">عرض ومعالجة طلبات شهادات إكمال الدورات</p>
          </div>
          <CertificatesDashboard />
        </div>
      </main>
    </div>
  );
}
