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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useLocation } from "wouter";
import SidebarNavigation from "@/components/SidebarNavigation";
import {
  UserPlus,
  Trash2,
  Edit,
  Shield,
  User,
  Key,
  RefreshCw,
} from "lucide-react";

export default function AdminUsers() {
  const [, navigate] = useLocation();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"superadmin" | "admin" | "teacher">("admin");

  const utils = trpc.useUtils();

  // Auth check
  const { data: adminUser, isLoading: authLoading } = trpc.admin.me.useQuery(undefined, {
    retry: false,
  });

  // Users data
  const { data: users, isLoading: usersLoading, refetch } = trpc.admin.getAdminUsers.useQuery(undefined, {
    enabled: !!adminUser && (adminUser.role === "superadmin" || adminUser.isSuperAdmin === 1),
  });

  // Mutations
  const createUser = trpc.admin.createAdminUser.useMutation({
    onSuccess: () => {
      utils.admin.getAdminUsers.invalidate();
      setIsAddModalOpen(false);
      resetForm();
      toast.success("تم إضافة المستخدم بنجاح");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateUser = trpc.admin.updateAdminUser.useMutation({
    onSuccess: () => {
      utils.admin.getAdminUsers.invalidate();
      setIsEditModalOpen(false);
      setEditingUser(null);
      resetForm();
      toast.success("تم تحديث بيانات المستخدم");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteUser = trpc.admin.deleteAdminUser.useMutation({
    onSuccess: () => {
      utils.admin.getAdminUsers.invalidate();
      setDeleteId(null);
      toast.success("تم حذف المستخدم");
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setRole("admin");
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setUsername(user.username);
    setRole(user.role);
    setPassword(""); // Keep password empty unless changing
    setIsEditModalOpen(true);
  };

  // Redirect if not authenticated or not superadmin
  // 🛡️ Absolute Override: Ensure yahya1019 is ALWAYS treated as SuperAdmin
  const isSuperAdmin = adminUser?.username === "yahya1019" || adminUser?.role === "superadmin" || adminUser?.isSuperAdmin === 1;
  
  if (!authLoading && (!adminUser || !isSuperAdmin)) {
    navigate("/admin/login");
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50/50 flex-col lg:flex-row">
      <SidebarNavigation />
      
      <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">إدارة المستخدمين</h1>
              <p className="text-gray-500 mt-1">إضافة وتعديل صلاحيات مديري النظام والأساتذة</p>
            </div>
            <Button onClick={() => { resetForm(); setIsAddModalOpen(true); }} className="gap-2 bg-blue-600">
              <UserPlus className="w-4 h-4" />
              إضافة مستخدم جديد
            </Button>
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-lg">قائمة المستخدمين</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={usersLoading}>
                <RefreshCw className={`w-4 h-4 ${usersLoading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {usersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80">
                        <TableHead className="text-right font-semibold">اسم المستخدم</TableHead>
                        <TableHead className="text-right font-semibold">الصلاحية</TableHead>
                        <TableHead className="text-right font-semibold">تاريخ الإنشاء</TableHead>
                        <TableHead className="text-right font-semibold w-24">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((user) => (
                        <TableRow key={user.id} className="hover:bg-blue-50/30 transition-colors">
                          <TableCell className="font-medium flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            {user.username}
                            {user.isSuperAdmin === 1 && (
                              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] rounded font-bold">رئيسي</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              user.role === "superadmin" ? "bg-purple-100 text-purple-700" :
                              user.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                            }`}>
                              <Shield className="w-3 h-3" />
                              {user.role === "superadmin" ? "مدير نظام" : user.role === "admin" ? "إداري" : "أستاذ"}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString("ar-SA")}
                          </TableCell>
                          <TableCell className="flex gap-1">
                            <Button variant="ghost" size="icon" className="w-8 h-8 text-blue-500" onClick={() => handleEdit(user)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            {user.isSuperAdmin !== 1 && (
                              <Button variant="ghost" size="icon" className="w-8 h-8 text-red-400" onClick={() => setDeleteId(user.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add User Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>إضافة مستخدم جديد</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>اسم المستخدم</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input value={username} onChange={(e) => setUsername(e.target.value)} className="pr-10" placeholder="مثال: teacher_ahmed" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <div className="relative">
                <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" placeholder="6 أحرف على الأقل" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>الصلاحية</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">أستاذ (إضافة درجات فقط)</SelectItem>
                  <SelectItem value="admin">إداري (عرض وتعديل الطلبات)</SelectItem>
                  <SelectItem value="superadmin">مدير نظام (صلاحيات كاملة)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>إلغاء</Button>
            <Button onClick={() => createUser.mutate({ username, password, role })} disabled={createUser.isPending}>
              {createUser.isPending ? "جاري الإضافة..." : "حفظ المستخدم"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>اسم المستخدم</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة (اتركها فارغة لعدم التغيير)</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" />
            </div>
            {editingUser?.isSuperAdmin !== 1 && (
              <div className="space-y-2">
                <Label>الصلاحية</Label>
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">أستاذ (إضافة درجات فقط)</SelectItem>
                    <SelectItem value="admin">إداري (عرض وتعديل الطلبات)</SelectItem>
                    <SelectItem value="superadmin">مدير نظام (صلاحيات كاملة)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>إلغاء</Button>
            <Button onClick={() => updateUser.mutate({ 
              id: editingUser.id, 
              username, 
              role, 
              password: password || undefined 
            })} disabled={updateUser.isPending}>
              {updateUser.isPending ? "جاري التحديث..." : "تحديث البيانات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف هذا المستخدم نهائياً ولن يتمكن من الدخول إلى لوحة التحكم.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteUser.mutate({ id: deleteId })} className="bg-red-600">حذف المستخدم</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
