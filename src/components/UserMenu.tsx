import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Shield, ChevronDown, Users, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

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

export function UserMenu() {
  const { profile, loading, signOut, canAccessAdminFeatures, canAccessGestorFeatures } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const { error } = await signOut();
    
    if (error) {
      toast({
        title: 'Erro ao sair',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      navigate('/auth');
    }
    setIsLoggingOut(false);
  };

  // Show loading skeleton while profile is being fetched
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="w-20 h-4 hidden sm:block" />
      </div>
    );
  }

  // Show minimal menu with logout option if profile failed to load
  if (!profile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-3">
            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <User className="w-4 h-4 text-destructive" />
            </div>
            <span className="hidden sm:inline-block text-sm text-muted-foreground">
              Menu
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            Erro ao carregar perfil
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleLogout} 
            disabled={isLoggingOut}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {isLoggingOut ? 'Saindo...' : 'Sair'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <span className="hidden sm:inline-block max-w-[120px] truncate">
            {profile.full_name}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium">{profile.full_name}</p>
            <Badge variant="secondary" className={roleColors[profile.role]}>
              <Shield className="w-3 h-3 mr-1" />
              {roleLabels[profile.role]}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canAccessGestorFeatures() && (
          <DropdownMenuItem 
            onClick={() => navigate('/reports')}
            className="cursor-pointer"
          >
            <FileText className="w-4 h-4 mr-2" />
            Relatórios e Aprovações
          </DropdownMenuItem>
        )}
        {canAccessAdminFeatures() && (
          <DropdownMenuItem 
            onClick={() => navigate('/users')}
            className="cursor-pointer"
          >
            <Users className="w-4 h-4 mr-2" />
            Gerenciar Usuários
          </DropdownMenuItem>
        )}
        {canAccessGestorFeatures() && (
          <DropdownMenuSeparator />
        )}
        <DropdownMenuItem 
          onClick={handleLogout} 
          disabled={isLoggingOut}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {isLoggingOut ? 'Saindo...' : 'Sair'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
