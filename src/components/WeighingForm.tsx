import { useState } from 'react';
import { Scale, Truck, User, Package, MapPin, FileText, Save } from 'lucide-react';
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
import { WeighingRecord, PhotoData } from '@/types/weighing';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CategoryPhotoCapture } from '@/components/CategoryPhotoCapture';

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

export function WeighingForm({ isOffline, onSubmit }: WeighingFormProps) {
  const [vehiclePlatePhoto, setVehiclePlatePhoto] = useState<PhotoData | null>(null);
  const [tarePhoto, setTarePhoto] = useState<PhotoData | null>(null);
  const [productPhoto, setProductPhoto] = useState<PhotoData | null>(null);
  
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

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatWeight = (value: string): string => {
    // Remove non-numeric characters except decimal point
    const cleanValue = value.replace(/[^\d.]/g, '');
    const numValue = parseFloat(cleanValue);
    
    if (isNaN(numValue)) return '';
    
    // Format with 3 decimal places
    return numValue.toLocaleString('pt-BR', { 
      minimumFractionDigits: 3, 
      maximumFractionDigits: 3 
    });
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Allow only numbers and decimal point during input
    const cleanValue = value.replace(/[^\d.]/g, '');
    setFormData(prev => ({ ...prev, [name]: cleanValue }));
  };

  const handleWeightBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (value) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        // Store as number string with 3 decimal places
        setFormData(prev => ({ ...prev, [name]: numValue.toFixed(3) }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vehiclePlate || !formData.grossWeight || !formData.tareWeight) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const photos: PhotoData[] = [
      vehiclePlatePhoto,
      tarePhoto,
      productPhoto,
    ].filter((p): p is PhotoData => p !== null);

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
      photos: photos.length > 0 ? photos : undefined,
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
    setVehiclePlatePhoto(null);
    setTarePhoto(null);
    setProductPhoto(null);

    toast.success(
      isOffline 
        ? 'Registro salvo localmente. Será sincronizado quando houver conexão.'
        : 'Registro salvo e sincronizado com sucesso!'
    );
  };

  const displayWeight = (value: string) => {
    if (!value) return '';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    return numValue.toLocaleString('pt-BR', { 
      minimumFractionDigits: 3, 
      maximumFractionDigits: 3 
    });
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
          <div className="flex gap-2">
            <Input
              id="vehiclePlate"
              name="vehiclePlate"
              value={formData.vehiclePlate}
              onChange={handleChange}
              placeholder="ABC1D23 ou ABC-1234"
              className="uppercase font-mono text-lg flex-1"
              maxLength={8}
            />
            <CategoryPhotoCapture
              category="vehiclePlate"
              photo={vehiclePlatePhoto}
              onPhotoChange={setVehiclePlatePhoto}
              label="placa"
            />
          </div>
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
              label="produto"
            />
          </div>
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
            Tara (kg) *
          </Label>
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
              label="tara"
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

        {/* Destination */}
        <div className="space-y-2">
          <Label htmlFor="destination" className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Destino
          </Label>
          <Select
            value={formData.destination}
            onValueChange={(value) => handleSelectChange('destination', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a cidade de destino" />
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