import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Users,
  Award,
  LogOut,
  Menu,
  X,
  GraduationCap,
  UserCog,
  Phone,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function SidebarNavigation() {
  const [location, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const logoutMutation = trpc.admin.logout.useMutation({
    onSuccess: () => navigate("/admin/login"),
  });

  const { data: adminUser, isLoading: isAuthLoading } = trpc.admin.me.useQuery();
  // 🛡️ Absolute Override: Ensure yahya1019 is ALWAYS treated as SuperAdmin
  const isSuperAdmin = adminUser?.username === "yahya1019" || adminUser?.role === "superadmin" || adminUser?.isSuperAdmin === 1;

  const menuItems = [
    {
      title: "طلبات التسجيل",
      icon: Users,
      path: "/admin",
      active: location === "/admin",
    },
    {
      title: "طلبات الشهادات",
      icon: Award,
      path: "/admin/certificates",
      active: location === "/admin/certificates",
    },
    ...(isSuperAdmin ? [{
      title: "إدارة المستخدمين",
      icon: UserCog,
      path: "/admin/users",
      active: location === "/admin/users",
    }] : []),
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile Header with Menu Button */}
      <header
        className="lg:hidden text-white shadow-md flex items-center justify-between px-4 h-16 fixed top-0 left-0 right-0 z-50"
        style={{ background: "linear-gradient(135deg, #0b3f86, #0f5bb7)" }}
      >
        <div 
          className={`flex items-center gap-2 ${isSuperAdmin ? "cursor-pointer" : ""}`}
          onClick={() => {
            if (isSuperAdmin) {
              navigate("/admin/users");
              setIsOpen(false);
            }
          }}
        >
          <GraduationCap className="w-6 h-6" />
          <span className="font-bold">مركز الأمجاد</span>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-white">
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </header>

      {/* Sidebar Drawer for Mobile & Permanent for Desktop */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-64 bg-white border-l shadow-xl transition-transform duration-300 transform lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } lg:static lg:inset-0`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header (Desktop only) - Clickable for SuperAdmin */}
          <div className="hidden lg:block">
            {isSuperAdmin ? (
              <button
                onClick={() => {
                  navigate("/admin/users");
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 p-6 border-b bg-gray-50/50 hover:bg-blue-50 transition-colors w-full cursor-pointer group"
                title="إدارة المستخدمين"
              >
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-blue-200">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h1 className="font-bold text-blue-900 leading-tight">مركز الأمجاد</h1>
                  <p className="text-xs text-blue-600/70">لوحة التحكم</p>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-3 p-6 border-b bg-gray-50/50 w-full">
                <div className="w-10 h-10 bg-gray-400 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h1 className="font-bold text-gray-900 leading-tight">مركز الأمجاد</h1>
                  <p className="text-xs text-gray-500">لوحة التحكم</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-2 mt-4">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  item.active
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                }`}
              >
                <item.icon className={`w-5 h-5 ${item.active ? "text-white" : "text-gray-400"}`} />
                <span className="font-medium">{item.title}</span>
              </button>
            ))}
          </nav>

          {/* Logout Section with Developer Copyright */}
          <div className="p-4 border-t space-y-4">
            <button
              onClick={() => logoutMutation.mutate()}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">تسجيل الخروج</span>
            </button>
            
            {/* Developer Copyright */}
            <div className="text-center pt-4 border-t">
              <p className="text-xs text-gray-600 font-semibold mb-2">جميع الحقوق محفوظة © 2026</p>
              <p className="text-xs text-gray-700 font-medium mb-2">تنفيذ وتطوير م/يحيى المريسي</p>
              <a 
                href="tel:967770400943" 
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span className="text-xs font-semibold">967770400943</span>
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
    </>
  );
}
