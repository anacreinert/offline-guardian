import { useState } from 'react';
import { Scale, Truck, User, Package, MapPin, FileText, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WeighingRecord } from '@/types/weighing';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WeighingFormProps {
  isOffline: boolean;
  onSubmit: (data: Omit<WeighingRecord, 'id' | 'timestamp' | 'syncStatus' | 'syncAttempts' | 'createdOffline'>) => void;
}

export function WeighingForm({ isOffline, onSubmit }: WeighingFormProps) {
  const [formData, setFormData] = useState({
    vehiclePlate: '',
    driverName: '',
    product: '',
    grossWeight: '',
    tareWeight: '',
    origin: '',
    destination: '',
    notes: '',
  });

  const netWeight = formData.grossWeight && formData.tareWeight
    ? Math.max(0, Number(formData.grossWeight) - Number(formData.tareWeight))
    : 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vehiclePlate || !formData.grossWeight || !formData.tareWeight) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    onSubmit({
      vehiclePlate: formData.vehiclePlate.toUpperCase(),
      driverName: formData.driverName,
      product: formData.product,
      grossWeight: Number(formData.grossWeight),
      tareWeight: Number(formData.tareWeight),
      netWeight,
      origin: formData.origin,
      destination: formData.destination,
      notes: formData.notes,
    });

    // Reset form
    setFormData({
      vehiclePlate: '',
      driverName: '',
      product: '',
      grossWeight: '',
      tareWeight: '',
      origin: '',
      destination: '',
      notes: '',
    });

    toast.success(
      isOffline 
        ? 'Registro salvo localmente. Será sincronizado quando houver conexão.'
        : 'Registro salvo e sincronizado com sucesso!'
    );
  };

  return (
    <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-primary/10">
          <Scale className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Novo Registro de Pesagem</h2>
          <p className="text-sm text-muted-foreground">
            {isOffline ? 'Modo offline - dados serão sincronizados depois' : 'Sistema conectado'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vehicle Plate */}
        <div className="space-y-2">
          <Label htmlFor="vehiclePlate" className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-muted-foreground" />
            Placa do Veículo *
          </Label>
          <Input
            id="vehiclePlate"
            name="vehiclePlate"
            value={formData.vehiclePlate}
            onChange={handleChange}
            placeholder="ABC1D23 ou ABC-1234"
            className="uppercase font-mono text-lg"
            maxLength={8}
          />
          <p className="text-xs text-muted-foreground">Formato Mercosul (ABC1D23) ou antigo (ABC-1234)</p>
        </div>

        {/* Driver Name */}
        <div className="space-y-2">
          <Label htmlFor="driverName" className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Nome do Motorista
          </Label>
          <Input
            id="driverName"
            name="driverName"
            value={formData.driverName}
            onChange={handleChange}
            placeholder="Nome completo"
          />
        </div>

        {/* Product */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="product" className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            Produto
          </Label>
          <Input
            id="product"
            name="product"
            value={formData.product}
            onChange={handleChange}
            placeholder="Tipo de carga"
          />
        </div>

        {/* Gross Weight */}
        <div className="space-y-2">
          <Label htmlFor="grossWeight" className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-muted-foreground" />
            Peso Bruto (kg) *
          </Label>
          <Input
            id="grossWeight"
            name="grossWeight"
            type="number"
            value={formData.grossWeight}
            onChange={handleChange}
            placeholder="0.000"
            className="font-mono text-lg"
            step="0.001"
            min="0"
          />
        </div>

        {/* Tare Weight */}
        <div className="space-y-2">
          <Label htmlFor="tareWeight" className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-muted-foreground" />
            Tara (kg) *
          </Label>
          <Input
            id="tareWeight"
            name="tareWeight"
            type="number"
            value={formData.tareWeight}
            onChange={handleChange}
            placeholder="0.000"
            className="font-mono text-lg"
            step="0.001"
            min="0"
          />
        </div>

        {/* Net Weight Display */}
        <div className="md:col-span-2">
          <div className={cn(
            'p-4 rounded-xl border-2 border-dashed',
            'bg-primary/5 border-primary/30'
          )}>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Peso Líquido</span>
              <span className="text-3xl font-mono font-bold text-primary">
                {netWeight.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg
              </span>
            </div>
          </div>
        </div>

        {/* Origin */}
        <div className="space-y-2">
          <Label htmlFor="origin" className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Origem
          </Label>
          <Input
            id="origin"
            name="origin"
            value={formData.origin}
            onChange={handleChange}
            placeholder="Local de origem"
          />
        </div>

        {/* Destination */}
        <div className="space-y-2">
          <Label htmlFor="destination" className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Destino
          </Label>
          <Input
            id="destination"
            name="destination"
            value={formData.destination}
            onChange={handleChange}
            placeholder="Local de destino"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes" className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Observações
          </Label>
          <Textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Informações adicionais..."
            rows={3}
          />
        </div>
      </div>

      <Button 
        type="submit" 
        size="lg" 
        className={cn(
          'w-full gap-2 text-lg font-semibold',
          isOffline && 'bg-status-offline hover:bg-status-offline/90'
        )}
      >
        <Save className="w-5 h-5" />
        {isOffline ? 'Salvar Localmente' : 'Registrar Pesagem'}
      </Button>
    </form>
  );
}
