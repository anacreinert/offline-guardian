import { useState, useEffect } from 'react';
import { Scale, Truck, User, Package, MapPin, FileText, Save, Hash, Building, Calendar, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WeighingRecord, PhotoData, VEHICLE_TYPES, HARVESTS, VehicleType } from '@/types/weighing';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CategoryPhotoCapture } from '@/components/CategoryPhotoCapture';
import { Separator } from '@/components/ui/separator';

// Santa Catarina cities
const SC_CITIES = [
  'Florianópolis',
  'Joinville',
  'Blumenau',
  'São José',
  'Chapecó',
  'Criciúma',
  'Itajaí',
  'Jaraguá do Sul',
  'Lages',
  'Palhoça',
  'Balneário Camboriú',
  'Brusque',
  'Tubarão',
  'São Bento do Sul',
  'Caçador',
  'Concórdia',
  'Camboriú',
  'Navegantes',
  'Rio do Sul',
  'Araranguá',
  'Gaspar',
  'Biguaçu',
  'Indaial',
  'Mafra',
  'Canoinhas',
  'Içara',
  'Laguna',
  'Videira',
  'Xanxerê',
  'São Francisco do Sul',
  'Joaçaba',
  'Imbituba',
  'Tijucas',
  'Curitibanos',
  'Porto União',
  'Campos Novos',
  'Fraiburgo',
  'Penha',
  'Guaramirim',
  'Sombrio',
];

// Agricultural products
const AGRO_PRODUCTS = [
  'Soja',
  'Milho',
  'Trigo',
  'Sorgo',
  'Café',
  'Feijão',
  'Arroz',
];

interface WeighingFormProps {
  isOffline: boolean;
  onSubmit: (data: Omit<WeighingRecord, 'id' | 'timestamp' | 'syncStatus' | 'syncAttempts' | 'createdOffline'>) => void;
}

// Generate ticket number in format YYYY-MM-XXXX
const generateTicketNumber = () => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const seq = Math.floor(Math.random() * 9999) + 1;
  return `${yearMonth}-${String(seq).padStart(4, '0')}`;
};

export function WeighingForm({ isOffline, onSubmit }: WeighingFormProps) {
  const [vehiclePlatePhoto, setVehiclePlatePhoto] = useState<PhotoData | null>(null);
  const [tarePhoto, setTarePhoto] = useState<PhotoData | null>(null);
  const [productPhoto, setProductPhoto] = useState<PhotoData | null>(null);
  
  const [formData, setFormData] = useState({
    // Identification
    ticketNumber: generateTicketNumber(),
    vehiclePlate: '',
    vehicleType: '' as VehicleType | '',
    driverName: '',
    supplier: '',
    origin: '',
    // Product
    product: '',
    harvest: '',
    destination: '',
    // Weighing
    grossWeight: '',
    tareWeight: '',
    scaleNumber: '',
    // Additional
    notes: '',
  });

  const netWeight = formData.grossWeight && formData.tareWeight
    ? Math.max(0, Number(formData.grossWeight) - Number(formData.tareWeight))
    : 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePlateRecognized = (plate: string) => {
    setFormData(prev => ({ ...prev, vehiclePlate: plate }));
  };

  const handleTareRecognized = (weight: number) => {
    setFormData(prev => ({ ...prev, tareWeight: weight.toFixed(3) }));
  };

  const handleBothWeightsRecognized = (tare: number, gross: number) => {
    setFormData(prev => ({ 
      ...prev, 
      tareWeight: tare.toFixed(3),
      grossWeight: gross.toFixed(3)
    }));
  };

  const handleProductRecognized = (product: string) => {
    setFormData(prev => ({ ...prev, product }));
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const cleanValue = value.replace(/[^\d.]/g, '');
    setFormData(prev => ({ ...prev, [name]: cleanValue }));
  };

  const handleWeightBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (value) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setFormData(prev => ({ ...prev, [name]: numValue.toFixed(3) }));
      }
    }
  };

  const validateForm = (): boolean => {
    if (!formData.vehiclePlate) {
      toast.error('Placa do veículo é obrigatória');
      return false;
    }
    if (!formData.grossWeight || Number(formData.grossWeight) <= 0) {
      toast.error('Peso bruto é obrigatório');
      return false;
    }
    if (!formData.tareWeight || Number(formData.tareWeight) <= 0) {
      toast.error('Tara é obrigatória');
      return false;
    }
    if (Number(formData.grossWeight) <= Number(formData.tareWeight)) {
      toast.error('Peso bruto deve ser maior que a tara');
      return false;
    }
    if (!formData.product) {
      toast.error('Produto é obrigatório');
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const photos: PhotoData[] = [
      vehiclePlatePhoto,
      tarePhoto,
      productPhoto,
    ].filter((p): p is PhotoData => p !== null);

    const now = new Date();

    onSubmit({
      // Identification
      ticketNumber: formData.ticketNumber,
      vehiclePlate: formData.vehiclePlate.toUpperCase(),
      vehicleType: formData.vehicleType || undefined,
      driverName: formData.driverName,
      supplier: formData.supplier,
      origin: formData.origin,
      // Product
      product: formData.product,
      harvest: formData.harvest,
      destination: formData.destination,
      // Weighing
      grossWeight: Number(formData.grossWeight),
      tareWeight: Number(formData.tareWeight),
      netWeight,
      scaleNumber: formData.scaleNumber,
      entryTime: now,
      exitTime: now,
      status: 'completed',
      // Additional
      notes: formData.notes,
      photos: photos.length > 0 ? photos : undefined,
    });

    // Reset form with new ticket number
    setFormData({
      ticketNumber: generateTicketNumber(),
      vehiclePlate: '',
      vehicleType: '',
      driverName: '',
      supplier: '',
      origin: '',
      product: '',
      harvest: '',
      destination: '',
      grossWeight: '',
      tareWeight: '',
      scaleNumber: '',
      notes: '',
    });
    setVehiclePlatePhoto(null);
    setTarePhoto(null);
    setProductPhoto(null);

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
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Novo Registro de Pesagem</h2>
          <p className="text-sm text-muted-foreground">
            {isOffline ? 'Modo offline - dados serão sincronizados depois' : 'Sistema conectado'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Ticket</p>
          <p className="font-mono font-bold text-primary">{formData.ticketNumber}</p>
        </div>
      </div>

      {/* SEÇÃO 1: IDENTIFICAÇÃO */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Identificação</h3>
        </div>
        <Separator className="bg-border/50" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vehicle Plate */}
          <div className="space-y-2">
            <Label htmlFor="vehiclePlate" className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-muted-foreground" />
              Placa do Veículo *
            </Label>
            <div className="flex gap-2">
              <Input
                id="vehiclePlate"
                name="vehiclePlate"
                value={formData.vehiclePlate}
                onChange={handleChange}
                placeholder="ABC1D23"
                className="uppercase font-mono text-lg flex-1"
                maxLength={8}
              />
              <CategoryPhotoCapture
                category="vehiclePlate"
                photo={vehiclePlatePhoto}
                onPhotoChange={setVehiclePlatePhoto}
                onPlateRecognized={handlePlateRecognized}
                label="placa"
              />
            </div>
          </div>

          {/* Vehicle Type */}
          <div className="space-y-2">
            <Label htmlFor="vehicleType" className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-muted-foreground" />
              Tipo do Veículo
            </Label>
            <Select
              value={formData.vehicleType}
              onValueChange={(value) => handleSelectChange('vehicleType', value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                {VEHICLE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {/* Supplier */}
          <div className="space-y-2">
            <Label htmlFor="supplier" className="flex items-center gap-2">
              <Building className="w-4 h-4 text-muted-foreground" />
              Produtor/Fornecedor
            </Label>
            <Input
              id="supplier"
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
              placeholder="Nome do produtor ou fornecedor"
            />
          </div>

          {/* Origin */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="origin" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Origem
            </Label>
            <Select
              value={formData.origin}
              onValueChange={(value) => handleSelectChange('origin', value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a cidade de origem" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50 max-h-[300px]">
                {SC_CITIES.sort().map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: PRODUTO */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Produto</h3>
        </div>
        <Separator className="bg-border/50" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Product */}
          <div className="space-y-2">
            <Label htmlFor="product" className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              Produto *
            </Label>
            <div className="flex gap-2">
              <Select
                value={formData.product}
                onValueChange={(value) => handleSelectChange('product', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {AGRO_PRODUCTS.map((product) => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <CategoryPhotoCapture
                category="product"
                photo={productPhoto}
                onPhotoChange={setProductPhoto}
                onProductRecognized={handleProductRecognized}
                label="produto"
              />
            </div>
          </div>

          {/* Harvest */}
          <div className="space-y-2">
            <Label htmlFor="harvest" className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Safra
            </Label>
            <Select
              value={formData.harvest}
              onValueChange={(value) => handleSelectChange('harvest', value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a safra" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                {HARVESTS.map((harvest) => (
                  <SelectItem key={harvest} value={harvest}>
                    {harvest}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="destination" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Destino (Unidade Armazenadora)
            </Label>
            <Select
              value={formData.destination}
              onValueChange={(value) => handleSelectChange('destination', value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o destino" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50 max-h-[300px]">
                {SC_CITIES.sort().map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: PESAGENS */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Pesagens</h3>
        </div>
        <Separator className="bg-border/50" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Scale Number */}
          <div className="space-y-2">
            <Label htmlFor="scaleNumber" className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-muted-foreground" />
              Nº da Balança
            </Label>
            <Input
              id="scaleNumber"
              name="scaleNumber"
              value={formData.scaleNumber}
              onChange={handleChange}
              placeholder="Ex: BAL-01"
              className="font-mono"
            />
          </div>

          {/* Empty cell for alignment */}
          <div className="hidden md:block" />

          {/* Gross Weight */}
          <div className="space-y-2">
            <Label htmlFor="grossWeight" className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              Peso Bruto - Entrada (kg) *
            </Label>
            <p className="text-xs text-muted-foreground">Veículo carregado</p>
            <Input
              id="grossWeight"
              name="grossWeight"
              type="text"
              inputMode="decimal"
              value={formData.grossWeight}
              onChange={handleWeightChange}
              onBlur={handleWeightBlur}
              placeholder="0,000"
              className="font-mono text-lg"
            />
          </div>

          {/* Tare Weight */}
          <div className="space-y-2">
            <Label htmlFor="tareWeight" className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              Tara - Saída (kg) *
            </Label>
            <p className="text-xs text-muted-foreground">Veículo vazio</p>
            <div className="flex gap-2">
              <Input
                id="tareWeight"
                name="tareWeight"
                type="text"
                inputMode="decimal"
                value={formData.tareWeight}
                onChange={handleWeightChange}
                onBlur={handleWeightBlur}
                placeholder="0,000"
                className="font-mono text-lg flex-1"
              />
              <CategoryPhotoCapture
                category="tare"
                photo={tarePhoto}
                onPhotoChange={setTarePhoto}
                onWeightRecognized={handleTareRecognized}
                onBothWeightsRecognized={handleBothWeightsRecognized}
                label="tara/pbt"
              />
            </div>
          </div>

          {/* Net Weight Display */}
          <div className="md:col-span-2">
            <div className={cn(
              'p-4 rounded-xl border-2 border-dashed',
              'bg-primary/5 border-primary/30'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground font-medium">Peso Líquido</span>
                  <p className="text-xs text-muted-foreground">Peso Bruto − Tara</p>
                </div>
                <span className="text-3xl font-mono font-bold text-primary">
                  {netWeight.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 4: OBSERVAÇÕES */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Observações</h3>
        </div>
        <Separator className="bg-border/50" />
        
        <Textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Informações adicionais, exceções operacionais, etc."
          rows={3}
        />
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
