import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, Clock, ArrowLeft, Calendar, Users, Scale } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserMenu } from '@/components/UserMenu';
import { ApprovalList } from '@/components/ApprovalList';
import { DailyReportSummary } from '@/components/DailyReportSummary';

interface WeighingRecord {
  id: string;
  vehicle_plate: string;
  driver_name: string | null;
  product: string | null;
  gross_weight: number;
  tare_weight: number;
  net_weight: number;
  origin: string | null;
  destination: string | null;
  notes: string | null;
  created_offline: boolean;
  synced_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  user_id: string;
}

interface DailySummary {
  totalRecords: number;
  totalNetWeight: number;
  offlineRecords: number;
  pendingApproval: number;
  approvedRecords: number;
}

const Reports = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading, profile } = useAuth();
  const { toast } = useToast();
  
  const [records, setRecords] = useState<WeighingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dailySummary, setDailySummary] = useState<DailySummary>({
    totalRecords: 0,
    totalNetWeight: 0,
    offlineRecords: 0,
    pendingApproval: 0,
    approvedRecords: 0,
  });

  // Only gestor role can access this page
  const isProfileReady = !!profile;
  const isGestor = profile?.role === 'gestor';

  // Redirect if not authenticated or doesn't have permission
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth');
      return;
    }

    // Wait for profile to load before applying role-based redirects
    if (!loading && isAuthenticated && isProfileReady && !isGestor) {
      navigate('/');
      toast({
        title: 'Acesso negado',
        description: 'Apenas gestores podem acessar esta página.',
        variant: 'destructive',
      });
    }
  }, [isAuthenticated, loading, navigate, isGestor, isProfileReady, toast]);

  // Fetch all records
  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      const today = new Date();
      const start = startOfDay(today).toISOString();
      const end = endOfDay(today).toISOString();

      const { data, error } = await supabase
        .from('weighing_records')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fetchedRecords = data as WeighingRecord[];
      setRecords(fetchedRecords);

      // Calculate summary
      const offlineRecords = fetchedRecords.filter(r => r.created_offline);
      const pendingApproval = offlineRecords.filter(r => !r.approved_at);
      const approvedRecords = offlineRecords.filter(r => r.approved_at);
      const totalNetWeight = fetchedRecords.reduce((sum, r) => sum + Number(r.net_weight), 0);

      setDailySummary({
        totalRecords: fetchedRecords.length,
        totalNetWeight,
        offlineRecords: offlineRecords.length,
        pendingApproval: pendingApproval.length,
        approvedRecords: approvedRecords.length,
      });
    } catch (error) {
      console.error('Error fetching records:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os registros.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isGestor) {
      fetchRecords();
    }
  }, [isAuthenticated, isGestor]);

  const handleApprove = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('weighing_records')
        .update({
          approved_at: new Date().toISOString(),
          approved_by: profile?.user_id,
        })
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: 'Pesagem aprovada',
        description: 'O registro foi aprovado com sucesso.',
      });

      fetchRecords();
    } catch (error) {
      console.error('Error approving record:', error);
      toast({
        title: 'Erro ao aprovar',
        description: 'Não foi possível aprovar o registro.',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (recordId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('weighing_records')
        .update({
          rejected_at: new Date().toISOString(),
          rejected_by: profile?.user_id,
          rejection_reason: reason || null,
        })
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: 'Pesagem rejeitada',
        description: 'O registro foi rejeitado.',
      });

      fetchRecords();
    } catch (error) {
      console.error('Error rejecting record:', error);
      toast({
        title: 'Erro ao rejeitar',
        description: 'Não foi possível rejeitar o registro.',
        variant: 'destructive',
      });
    }
  };

  const handleApproveAll = async () => {
    try {
      const pendingRecords = records.filter(r => r.created_offline && !r.approved_at);
      
      if (pendingRecords.length === 0) {
        toast({
          title: 'Nenhum registro pendente',
          description: 'Não há registros offline para aprovar.',
        });
        return;
      }

      const { error } = await supabase
        .from('weighing_records')
        .update({
          approved_at: new Date().toISOString(),
          approved_by: profile?.user_id,
        })
        .in('id', pendingRecords.map(r => r.id));

      if (error) throw error;

      toast({
        title: 'Todos aprovados',
        description: `${pendingRecords.length} registros foram aprovados.`,
      });

      fetchRecords();
    } catch (error) {
      console.error('Error approving all records:', error);
      toast({
        title: 'Erro ao aprovar',
        description: 'Não foi possível aprovar os registros.',
        variant: 'destructive',
      });
    }
  };

  if (loading || (isAuthenticated && !profile)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated || !isGestor) {
    return null;
  }

  const offlineRecords = records.filter(r => r.created_offline);
  const pendingApprovalRecords = offlineRecords.filter(r => !r.approved_at && !r.rejected_at);
  const rejectedRecords = offlineRecords.filter(r => r.rejected_at);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Relatórios e Aprovações</h1>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>
          <UserMenu />
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <DailyReportSummary summary={dailySummary} isLoading={isLoading} />

        {/* Tabs */}
        <Tabs defaultValue="pending" className="mt-8">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              Pendentes ({pendingApprovalRecords.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Scale className="w-4 h-4" />
              Todos do Dia ({records.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            <ApprovalList 
              records={pendingApprovalRecords} 
              onApprove={handleApprove}
              onReject={handleReject}
              onApproveAll={handleApproveAll}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Todos os Registros de Hoje
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : records.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Scale className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum registro encontrado hoje.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {records.map(record => (
                      <div
                        key={record.id}
                        className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">{record.vehicle_plate}</span>
                              {record.created_offline && (
                                <Badge variant="secondary" className="text-xs">
                                  Offline
                                </Badge>
                              )}
                              {record.approved_at && (
                                <Badge className="bg-status-synced/20 text-status-synced text-xs">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Aprovado
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-0.5">
                              {record.driver_name && <p>Motorista: {record.driver_name}</p>}
                              {record.product && <p>Produto: {record.product}</p>}
                              <p>
                                {format(new Date(record.created_at), 'HH:mm', { locale: ptBR })}
                                {record.origin && record.destination && (
                                  <span> • {record.origin} → {record.destination}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-primary">
                              {Number(record.net_weight).toLocaleString('pt-BR')} kg
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Bruto: {Number(record.gross_weight).toLocaleString('pt-BR')} kg
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Reports;
