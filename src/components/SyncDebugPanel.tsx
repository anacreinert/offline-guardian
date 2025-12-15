import { useState } from 'react';
import { 
  Bug, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SyncQueue, WeighingRecord } from '@/types/weighing';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncDebugPanelProps {
  syncQueue: SyncQueue;
  records: WeighingRecord[];
  onSyncAll: () => void;
  isOnline: boolean;
}

export function SyncDebugPanel({ syncQueue, records, onSyncAll, isOnline }: SyncDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const pendingRecords = records.filter(r => r.syncStatus === 'pending' || r.syncStatus === 'error');
  const syncedRecords = records.filter(r => r.syncStatus === 'synced');
  const errorRecords = records.filter(r => r.syncStatus === 'error');

  const testDatabaseConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      // Test 1: Check auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        setTestResult(`❌ Erro de autenticação: ${authError.message}`);
        setIsTesting(false);
        return;
      }
      if (!user) {
        setTestResult('❌ Usuário não autenticado');
        setIsTesting(false);
        return;
      }

      // Test 2: Check user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (roleError) {
        setTestResult(`⚠️ Usuário: ${user.email}\n❌ Erro ao buscar role: ${roleError.message}`);
        setIsTesting(false);
        return;
      }

      // Test 3: Try to count records (SELECT)
      const { count, error: selectError } = await supabase
        .from('weighing_records')
        .select('*', { count: 'exact', head: true });

      if (selectError) {
        setTestResult(`✅ Usuário: ${user.email}\n✅ Role: ${roleData?.role}\n❌ Erro SELECT: ${selectError.message}`);
        setIsTesting(false);
        return;
      }

      // Test 4: Try a test insert and delete
      const testId = `test-${Date.now()}`;
      const { error: insertError } = await supabase
        .from('weighing_records')
        .insert({
          id: testId,
          user_id: user.id,
          vehicle_plate: 'TEST-0000',
          gross_weight: 1000,
          tare_weight: 500,
          net_weight: 500,
          status: 'test',
        });

      if (insertError) {
        setTestResult(
          `✅ Usuário: ${user.email}\n` +
          `✅ Role: ${roleData?.role}\n` +
          `✅ SELECT: ${count} registros visíveis\n` +
          `❌ INSERT falhou: ${insertError.message}\n` +
          `   Código: ${insertError.code}`
        );
        setIsTesting(false);
        return;
      }

      // Clean up test record
      await supabase
        .from('weighing_records')
        .delete()
        .eq('id', testId);

      setTestResult(
        `✅ Usuário: ${user.email}\n` +
        `✅ Role: ${roleData?.role}\n` +
        `✅ SELECT: ${count} registros visíveis\n` +
        `✅ INSERT: OK\n` +
        `✅ Conexão funcionando corretamente!`
      );
      toast.success('Teste de conexão bem-sucedido!');
    } catch (err: any) {
      setTestResult(`❌ Erro inesperado: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="glass-panel overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Bug className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">Debug de Sincronização</span>
          {errorRecords.length > 0 && (
            <span className="px-2 py-0.5 bg-destructive/20 text-destructive text-xs rounded-full">
              {errorRecords.length} erro(s)
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 border-t border-border/50 space-y-4 animate-fade-in">
          {/* Status Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-status-online" />
                ) : (
                  <WifiOff className="w-4 h-4 text-status-offline" />
                )}
                Conexão
              </div>
              <span className={cn(
                "font-semibold",
                isOnline ? "text-status-online" : "text-status-offline"
              )}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="w-4 h-4" />
                Pendentes
              </div>
              <span className={cn(
                "font-semibold",
                pendingRecords.length > 0 ? "text-status-offline" : "text-foreground"
              )}>
                {pendingRecords.length}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle2 className="w-4 h-4" />
                Sincronizados
              </div>
              <span className="font-semibold text-status-online">
                {syncedRecords.length}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <AlertCircle className="w-4 h-4" />
                Com Erro
              </div>
              <span className={cn(
                "font-semibold",
                errorRecords.length > 0 ? "text-status-error" : "text-foreground"
              )}>
                {errorRecords.length}
              </span>
            </div>
          </div>

          {/* Last Sync Time */}
          {syncQueue.lastSyncTime && (
            <div className="text-sm text-muted-foreground">
              Última sincronização: {syncQueue.lastSyncTime.toLocaleString('pt-BR')}
            </div>
          )}

          {/* Error Details */}
          {errorRecords.length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <div className="flex items-center gap-2 text-destructive font-medium mb-2">
                <AlertCircle className="w-4 h-4" />
                Registros com erro:
              </div>
              <div className="space-y-2 text-sm">
                {errorRecords.map(record => (
                  <div key={record.id} className="flex items-start gap-2">
                    <span className="font-mono">{record.vehiclePlate}</span>
                    <span className="text-destructive/80">
                      {record.syncError || 'Erro desconhecido'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div className="p-3 rounded-lg bg-secondary border border-border">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Database className="w-4 h-4" />
                Resultado do Teste:
              </div>
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {testResult}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={testDatabaseConnection}
              disabled={isTesting}
              className="gap-2"
            >
              {isTesting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              Testar Conexão
            </Button>

            <Button
              size="sm"
              onClick={onSyncAll}
              disabled={pendingRecords.length === 0 || syncQueue.isProcessing || !isOnline}
              className="gap-2"
            >
              <RefreshCw className={cn(
                "w-4 h-4",
                syncQueue.isProcessing && "animate-spin"
              )} />
              Sincronizar Todos ({pendingRecords.length})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
