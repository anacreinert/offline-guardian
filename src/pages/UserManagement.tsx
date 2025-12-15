import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Shield, Search, RefreshCw, Plus, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string;
  created_at: string;
  role: AppRole;
}

const roleLabels: Record<AppRole, string> = {
  operador: 'Operador',
  gestor: 'Gestor',
  admin: 'Administrador',
};

const roleColors: Record<AppRole, string> = {
  operador: 'bg-muted text-muted-foreground',
  gestor: 'bg-status-syncing/20 text-status-syncing',
  admin: 'bg-primary/20 text-primary',
};

const UserManagement = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading, profile } = useAuth();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  
  // Create user form
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'operador' as AppRole,
  });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth');
      return;
    }
    
    if (!loading && profile && !isAdmin) {
      toast({
        title: 'Acesso negado',
        description: 'Você não tem permissão para acessar esta página.',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }

    if (!loading && isAuthenticated && isAdmin) {
      fetchUsers();
    }
  }, [isAuthenticated, loading, profile, isAdmin, navigate]);

  useEffect(() => {
    const filtered = users.filter(user => 
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          created_at: profile.created_at,
          role: (userRole?.role as AppRole) || 'operador',
        };
      });

      setUsers(usersWithRoles);
      setFilteredUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Erro ao carregar usuários',
        description: 'Não foi possível carregar a lista de usuários.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createUser = async () => {
    if (!newUserData.email || !newUserData.password || !newUserData.fullName) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos para criar o usuário.',
        variant: 'destructive',
      });
      return;
    }

    if (newUserData.password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserData.email,
        password: newUserData.password,
        options: {
          data: {
            full_name: newUserData.fullName,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Update role if not default
        if (newUserData.role !== 'operador') {
          const { error: roleError } = await supabase
            .from('user_roles')
            .update({ role: newUserData.role })
            .eq('user_id', authData.user.id);

          if (roleError) throw roleError;
        }

        toast({
          title: 'Usuário criado',
          description: `${newUserData.fullName} foi cadastrado com sucesso.`,
        });

        setNewUserData({
          email: '',
          password: '',
          fullName: '',
          role: 'operador',
        });
        setIsCreateDialogOpen(false);
        
        // Refresh users list
        setTimeout(fetchUsers, 1000);
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Erro ao criar usuário',
        description: error.message || 'Não foi possível criar o usuário.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    // Prevent self-deletion
    if (userId === profile?.user_id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode excluir sua própria conta.',
        variant: 'destructive',
      });
      return;
    }

    setDeletingUserId(userId);
    try {
      // Delete profile (will cascade to user_roles due to FK)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Update local state
      setUsers(prev => prev.filter(user => user.user_id !== userId));

      toast({
        title: 'Usuário excluído',
        description: `${userName} foi removido do sistema.`,
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o usuário.',
        variant: 'destructive',
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    setUpdatingUserId(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      // Update local state
      setUsers(prev => prev.map(user => 
        user.user_id === userId ? { ...user, role: newRole } : user
      ));

      toast({
        title: 'Perfil atualizado',
        description: `Nível de acesso alterado para ${roleLabels[newRole]}.`,
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o nível de acesso.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-primary/10">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Gerenciamento de Usuários
                </h1>
                <p className="text-muted-foreground">
                  Crie, gerencie e exclua usuários do sistema
                </p>
              </div>
            </div>

            {/* Create User Button */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Novo Usuário</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário</DialogTitle>
                  <DialogDescription>
                    Preencha os dados para cadastrar um novo usuário no sistema.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo *</Label>
                    <Input
                      id="fullName"
                      value={newUserData.fullName}
                      onChange={(e) => setNewUserData(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="Nome do usuário"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUserData.password}
                      onChange={(e) => setNewUserData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Nível de Acesso</Label>
                    <Select
                      value={newUserData.role}
                      onValueChange={(value) => setNewUserData(prev => ({ ...prev, role: value as AppRole }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operador">Operador</SelectItem>
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={createUser} disabled={isCreating}>
                    {isCreating ? 'Criando...' : 'Criar Usuário'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Main Card */}
        <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Usuários Cadastrados</CardTitle>
                <CardDescription>
                  {users.length} usuário(s) no sistema
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={fetchUsers}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando usuários...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Nível de Acesso</TableHead>
                      <TableHead>Data de Cadastro</TableHead>
                      <TableHead>Alterar Nível</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name}
                          {user.user_id === profile?.user_id && (
                            <Badge variant="secondary" className="ml-2 text-xs">Você</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={roleColors[user.role]}>
                            <Shield className="w-3 h-3 mr-1" />
                            {roleLabels[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => updateUserRole(user.user_id, value as AppRole)}
                            disabled={updatingUserId === user.user_id}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="operador">Operador</SelectItem>
                              <SelectItem value="gestor">Gestor</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={user.user_id === profile?.user_id || deletingUserId === user.user_id}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Você está prestes a excluir <strong>{user.full_name}</strong> do sistema. 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUser(user.user_id, user.full_name)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
    </div>
  );
};

export default UserManagement;
