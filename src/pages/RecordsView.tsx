import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Scale, Wifi, Clock, CheckCircle, XCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { WeighingRecord } from '@/types/weighing';

type FilterType = 'all' | 'offline' | 'pending';

const filterConfig: Record<FilterType, { title: string; description: string; icon: typeof Scale }> = {
  all: {
    title: 'Todas as Pesagens de Hoje',
    description: 'Lista completa de registros do dia',
    icon: Scale,
  },
  offline: {
    title: 'Registros Offline',
    description: 'Pesagens realizadas sem conexão',
    icon: Wifi,
  },
  pending: {
    title: 'Pendentes de Sincronização',
    description: 'Registros aguardando envio ao servidor',
    icon: Clock,
  },
};

const RecordsView = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterType = (searchParams.get('filter') as FilterType) || 'all';
  
  const { isAuthenticated, loading } = useAuth();
  const { records, getTodayRecords, getPendingRecords } = useLocalStorage();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRecords, setFilteredRecords] = useState<WeighingRecord[]>([]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    let recordsToShow: WeighingRecord[] = [];
    const todayRecords = getTodayRecords();

    switch (filterType) {
      case 'offline':
        recordsToShow = todayRecords.filter(r => r.createdOffline);
        break;
      case 'pending':
        recordsToShow = getPendingRecords();
        break;
      default:
        recordsToShow = todayRecords;
    }

    // Apply search filter
    if (searchTerm) {
      recordsToShow = recordsToShow.filter(r =>
        r.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.product?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredRecords(recordsToShow);
  }, [filterType, records, searchTerm, getTodayRecords, getPendingRecords]);

  const config = filterConfig[filterType];
  const Icon = config.icon;

  const getSyncStatusBadge = (record: WeighingRecord) => {
    switch (record.syncStatus) {
      case 'synced':
        return (
          <Badge className="bg-status-synced/20 text-status-synced">
            <CheckCircle className="w-3 h-3 mr-1" />
            Sincronizado
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-status-syncing/20 text-status-syncing">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-status-error/20 text-status-error">
            <XCircle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return null;
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
          
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10">
              <Icon className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {config.title}
              </h1>
              <p className="text-muted-foreground">
                {config.description}
              </p>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                {filteredRecords.length} registro(s)
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar placa, motorista..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum registro encontrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Horário</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Peso Bruto</TableHead>
                      <TableHead className="text-right">Tara</TableHead>
                      <TableHead className="text-right">Peso Líquido</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(record.timestamp), 'HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-bold font-mono">
                          {record.vehiclePlate}
                        </TableCell>
                        <TableCell>{record.driverName || '-'}</TableCell>
                        <TableCell>{record.product || '-'}</TableCell>
                        <TableCell className="text-right font-mono">
                          {record.grossWeight.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {record.tareWeight.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-primary">
                          {record.netWeight.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {record.createdOffline && (
                              <Badge variant="secondary" className="text-xs">
                                <Wifi className="w-3 h-3 mr-1" />
                                Offline
                              </Badge>
                            )}
                            {getSyncStatusBadge(record)}
                          </div>
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

export default RecordsView;
