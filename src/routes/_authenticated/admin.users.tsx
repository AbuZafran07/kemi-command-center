import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { UserAvatar } from "@/components/profile/UserAvatar";
import { useAuth } from "@/components/providers/AppProviders";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type AdminUserRow,
  ORG_ROLES,
  type OrgRole,
  adminCreateUser,
  adminDeleteUser,
  adminListUsers,
  adminSetUserOrgRole,
  adminToggleSuperAdmin,
  adminUpdateUserProfile,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

function errorKey(error: Error): string {
  if (error.message.includes("LAST_SUPER_ADMIN")) return "admin.errLastSuperAdmin";
  if (error.message.includes("SUPER_ADMIN_SELF_REVOKE")) return "admin.errSelfRevoke";
  if (error.message.includes("SELF_DELETE")) return "admin.errSelfDelete";
  if (error.message.includes("EMAIL_EXISTS")) return "admin.errEmailExists";
  if (error.message.includes("FORBIDDEN")) return "admin.errForbidden";
  return "admin.errGeneric";
}

function AdminUsersPage() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();

  const fetchUsers = useServerFn(adminListUsers);
  const updateProfile = useServerFn(adminUpdateUserProfile);
  const setOrgRole = useServerFn(adminSetUserOrgRole);
  const toggleSuperAdmin = useServerFn(adminToggleSuperAdmin);
  const createUser = useServerFn(adminCreateUser);
  const deleteUser = useServerFn(adminDeleteUser);

  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });
  const users = usersQuery.data ?? [];

  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editDivision, setEditDivision] = useState("");
  const [roleChange, setRoleChange] = useState<{ user: AdminUserRow; role: OrgRole } | null>(null);
  const [adminChange, setAdminChange] = useState<{ user: AdminUserRow; enable: boolean } | null>(
    null,
  );
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    fullName: "",
    division: "",
    role: "Staff" as OrgRole,
  });
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    void queryClient.invalidateQueries({ queryKey: ["audit-log"] });
  };
  const onError = (error: Error) => toast.error(t(errorKey(error)));

  const profileMutation = useMutation({
    mutationFn: () =>
      updateProfile({
        data: { userId: editing!.id, fullName: editName, division: editDivision },
      }),
    onSuccess: () => {
      toast.success(t("admin.profileSaved"));
      setEditing(null);
      refresh();
    },
    onError,
  });

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: OrgRole }) => setOrgRole({ data: input }),
    onSuccess: () => {
      toast.success(t("admin.roleChanged"));
      setRoleChange(null);
      refresh();
    },
    onError: (error: Error) => {
      setRoleChange(null);
      onError(error);
    },
  });

  const adminMutation = useMutation({
    mutationFn: (input: { userId: string; enable: boolean }) => toggleSuperAdmin({ data: input }),
    onSuccess: () => {
      toast.success(t("admin.superAdminChanged"));
      setAdminChange(null);
      refresh();
    },
    onError: (error: Error) => {
      setAdminChange(null);
      onError(error);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => createUser({ data: newUser }),
    onSuccess: () => {
      toast.success(t("admin.userCreated"));
      setCreating(false);
      setNewUser({ email: "", password: "", fullName: "", division: "", role: "Staff" });
      refresh();
    },
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser({ data: { userId } }),
    onSuccess: () => {
      toast.success(t("admin.userDeleted"));
      setDeleting(null);
      refresh();
    },
    onError: (error: Error) => {
      setDeleting(null);
      onError(error);
    },
  });

  function openEdit(row: AdminUserRow) {
    setEditing(row);
    setEditName(row.full_name);
    setEditDivision(row.division);
  }

  const displayName = (row: AdminUserRow) => row.full_name || row.email;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("admin.sessionNote")}</p>
        <Button variant="brand" size="sm" onClick={() => setCreating(true)}>
          {t("admin.addUser")}
        </Button>
      </div>


      <Card>
        <CardContent className="p-0">
          {usersQuery.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : users.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("admin.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.colUser")}</TableHead>
                    <TableHead>{t("admin.colDivision")}</TableHead>
                    <TableHead>{t("admin.colRole")}</TableHead>
                    <TableHead>{t("admin.colSuperAdmin")}</TableHead>
                    <TableHead className="text-right">{t("admin.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((row) => {
                    const isMe = row.id === me?.id;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              name={displayName(row)}
                              avatarUrl={row.avatar_url}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {displayName(row)}
                                {isMe ? (
                                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    {t("admin.you")}
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{row.division || "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={row.org_role ?? ""}
                            onValueChange={(value) => {
                              if (value !== row.org_role) {
                                setRoleChange({ user: row, role: value as OrgRole });
                              }
                            }}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {ORG_ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={row.is_super_admin}
                            disabled={isMe && row.is_super_admin}
                            title={isMe && row.is_super_admin ? t("admin.errSelfRevoke") : ""}
                            onCheckedChange={(checked) =>
                              setAdminChange({ user: row, enable: checked })
                            }
                            aria-label={t("admin.colSuperAdmin")}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                              {t("admin.edit")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                              disabled={isMe}
                              title={isMe ? t("admin.errSelfDelete") : ""}
                              onClick={() => setDeleting(row)}
                            >
                              {t("admin.delete")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => (open ? null : setEditing(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.editTitle")}</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-edit-name">{t("admin.fullName")}</Label>
              <Input
                id="admin-edit-name"
                value={editName}
                maxLength={200}
                onChange={(event) => setEditName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-edit-division">{t("admin.division")}</Label>
              <Input
                id="admin-edit-division"
                value={editDivision}
                maxLength={100}
                onChange={(event) => setEditDivision(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="brand"
              disabled={editName.trim().length === 0 || profileMutation.isPending}
              onClick={() => profileMutation.mutate()}
            >
              {profileMutation.isPending ? t("admin.saving") : t("admin.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={roleChange !== null}
        onOpenChange={(open) => (open ? null : setRoleChange(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.roleConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {roleChange
                ? t("admin.roleConfirmDesc", {
                    name: displayName(roleChange.user),
                    from: roleChange.user.org_role ?? "—",
                    to: roleChange.role,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={roleMutation.isPending}
              onClick={() =>
                roleChange &&
                roleMutation.mutate({ userId: roleChange.user.id, role: roleChange.role })
              }
            >
              {t("admin.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={adminChange !== null}
        onOpenChange={(open) => (open ? null : setAdminChange(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {adminChange?.enable ? t("admin.grantTitle") : t("admin.revokeTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {adminChange
                ? t(adminChange.enable ? "admin.grantDesc" : "admin.revokeDesc", {
                    name: displayName(adminChange.user),
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={adminMutation.isPending}
              onClick={() =>
                adminChange &&
                adminMutation.mutate({ userId: adminChange.user.id, enable: adminChange.enable })
              }
            >
              {t("admin.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={creating} onOpenChange={(open) => (open ? null : setCreating(false))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.addUser")}</DialogTitle>
            <DialogDescription>{t("admin.addUserDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-full-name">{t("admin.fullName")}</Label>
              <Input
                id="new-full-name"
                maxLength={200}
                value={newUser.fullName}
                onChange={(event) => setNewUser((s) => ({ ...s, fullName: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-user-division">{t("admin.division")}</Label>
              <Input
                id="new-user-division"
                maxLength={100}
                value={newUser.division}
                onChange={(event) => setNewUser((s) => ({ ...s, division: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-user-email">{t("auth.email")}</Label>
              <Input
                id="new-user-email"
                type="email"
                value={newUser.email}
                onChange={(event) => setNewUser((s) => ({ ...s, email: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-user-password">{t("auth.password")}</Label>
              <Input
                id="new-user-password"
                type="password"
                value={newUser.password}
                onChange={(event) => setNewUser((s) => ({ ...s, password: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("admin.colRole")}</Label>
              <Select
                value={newUser.role}
                onValueChange={(value) => setNewUser((s) => ({ ...s, role: value as OrgRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("admin.passwordHint")}</p>
          </div>
          <DialogFooter>
            <Button
              variant="brand"
              disabled={
                createMutation.isPending ||
                newUser.fullName.trim().length === 0 ||
                !newUser.email.includes("@") ||
                newUser.password.length < 8
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? t("admin.saving") : t("admin.addUser")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => (open ? null : setDeleting(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? t("admin.deleteDesc", { name: displayName(deleting) }) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {t("admin.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
