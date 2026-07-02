import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useLocation } from "wouter";
import SidebarNavigation from "@/components/SidebarNavigation";
import {
  Search,
  Users,
  Clock,
  Phone,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_MAP = {
  pending:   { label: "قيد الانتظار",  color: "status-pending",   icon: Clock },
  contacted: { label: "تم التواصل",    color: "status-contacted", icon: Phone },
  enrolled:  { label: "مسجّل",         color: "status-enrolled",  icon: CheckCircle },
  rejected:  { label: "مرفوض",         color: "status-rejected",  icon: XCircle },
} as const;

type StatusKey = keyof typeof STATUS_MAP;

function StatusBadge({ status }: { status: StatusKey }) {
  const cfg = STATUS_MAP[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <cfg.icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ title, value, icon: Icon, color }: {
  title: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const PAGE_SIZE = 20;

  const utils = trpc.useUtils();

  // Auth check
  const { data: adminUser, isLoading: authLoading } = trpc.admin.me.useQuery(undefined, {
    retry: false,
  });

  // Stats
  const { data: stats } = trpc.admin.getStats.useQuery(undefined, {
    enabled: !!adminUser,
    refetchInterval: 30000,
  });

  // Registrations
  const { data: regData, isLoading: regLoading, refetch } = trpc.admin.getRegistrations.useQuery(
    { search, status: statusFilter, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    { enabled: !!adminUser }
  );

  // Export all
  const { refetch: fetchExport } = trpc.admin.exportAll.useQuery(undefined, {
    enabled: false,
  });

  // Mutations
  const updateStatus = trpc.admin.updateStatus.useMutation({
    onSuccess: () => {
      utils.admin.getRegistrations.invalidate();
      utils.admin.getStats.invalidate();
      toast.success("تم تحديث الحالة");
    },
    onError: () => toast.error("فشل تحديث الحالة"),
  });

  const deleteReg = trpc.admin.deleteRegistration.useMutation({
    onSuccess: () => {
      utils.admin.getRegistrations.invalidate();
      utils.admin.getStats.invalidate();
      setDeleteId(null);
      toast.success("تم حذف الطلب");
    },
    onError: () => toast.error("فشل حذف الطلب"),
  });

  // Redirect if not authenticated
  if (!authLoading && !adminUser) {
    navigate("/admin/login");
    return null;
  }

  // Export to Excel
  const handleExport = async () => {
    const { data } = await fetchExport();
    if (!data || data.length === 0) { toast.info("لا توجد بيانات للتصدير"); return; }

    const rows = data.map((r) => ({
      "رقم الطلب": r.id,
      "رقم العرض": r.offerIndex,
      "الاسم الكامل": r.fullName,
      "رقم الهاتف": r.phone,
      "البريد الإلكتروني": r.email || "",
      "الملاحظات": r.notes || "",
      "الحالة": STATUS_MAP[r.status as StatusKey]?.label || r.status,
      "تاريخ الطلب": new Date(r.createdAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" }),
    }));

    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    ws["!cols"] = [
      { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 18 },
      { wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "طلبات التسجيل");
    XLSX.writeFile(wb, `طلبات_مركز_الأمجاد_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`تم تصدير ${data.length} طلب بنجاح`);
  };

  const totalPages = Math.ceil((regData?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="flex min-h-screen bg-gray-50/50 flex-col lg:flex-row">
      <SidebarNavigation />
      
      <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">إدارة طلبات التسجيل</h1>
            <p className="text-gray-500 mt-1">عرض ومعالجة طلبات تسجيل في الدورات التدريبية</p>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="إجمالي الطلبات" value={stats.total} icon={Users} color="bg-blue-500" />
              <StatCard title="قيد الانتظار" value={stats.pending} icon={Clock} color="bg-yellow-500" />
              <StatCard title="تم التسجيل" value={stats.enrolled} icon={CheckCircle} color="bg-green-500" />
              <StatCard title="مرفوض" value={stats.rejected} icon={XCircle} color="bg-red-500" />
            </div>
          )}

          {/* Controls */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <CardTitle className="text-lg">قائمة الطلبات</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    className="gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    تحديث
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleExport}
                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    تصدير Excel
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم أو الهاتف أو البريد..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    className="pr-9 h-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-full sm:w-44 h-9">
                    <SelectValue placeholder="فلترة بالحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    <SelectItem value="contacted">تم التواصل</SelectItem>
                    <SelectItem value="enrolled">مسجّل</SelectItem>
                    <SelectItem value="rejected">مرفوض</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {regLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : !regData?.rows.length ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>لا توجد طلبات مطابقة</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/80">
                          <TableHead className="text-right font-semibold w-12">#</TableHead>
                          <TableHead className="text-right font-semibold w-14">العرض</TableHead>
                          <TableHead className="text-right font-semibold">الاسم</TableHead>
                          <TableHead className="text-right font-semibold">الهاتف</TableHead>
                          <TableHead className="text-right font-semibold hidden md:table-cell">البريد</TableHead>
                          <TableHead className="text-right font-semibold">الحالة</TableHead>
                          <TableHead className="text-right font-semibold hidden sm:table-cell">التاريخ</TableHead>
                          <TableHead className="text-right font-semibold w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regData.rows.map((reg) => (
                          <TableRow key={reg.id} className="hover:bg-blue-50/30 transition-colors">
                            <TableCell className="font-mono text-sm text-muted-foreground">{reg.id}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold text-sm">
                                {reg.offerIndex}
                              </span>
                            </TableCell>
                            <TableCell className="font-semibold">{reg.fullName}</TableCell>
                            <TableCell className="font-mono text-sm" dir="ltr">{reg.phone}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {reg.email || "—"}
                            </TableCell>
                            <TableCell>
                              {adminUser?.role === "teacher" ? (
                                <StatusBadge status={reg.status as StatusKey} />
                              ) : (
                                <Select
                                  value={reg.status}
                                  onValueChange={(v) =>
                                    updateStatus.mutate({ id: reg.id, status: v as StatusKey })
                                  }
                                >
                                  <SelectTrigger className="h-8 w-36 border-0 p-0 focus:ring-0 bg-transparent">
                                    <StatusBadge status={reg.status as StatusKey} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                                    <SelectItem value="contacted">تم التواصل</SelectItem>
                                    <SelectItem value="enrolled">مسجّل</SelectItem>
                                    <SelectItem value="rejected">مرفوض</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(reg.createdAt).toLocaleDateString("ar-SA", {
                                year: "numeric", month: "short", day: "numeric",
                              })}
                            </TableCell>
                            <TableCell>
                              {adminUser?.role !== "teacher" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-8 h-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => setDeleteId(reg.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-sm text-muted-foreground">
                        {regData.total} طلب إجمالاً
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                          disabled={page === 0}
                        >
                          السابق
                        </Button>
                        <span className="flex items-center text-sm px-2">
                          {page + 1} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                          disabled={page >= totalPages - 1}
                        >
                          التالي
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteReg.mutate({ id: deleteId })}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
