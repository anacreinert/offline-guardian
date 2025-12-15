import { useState, useEffect } from 'react';
import { Scale, Truck, User, Package, MapPin, FileText, Save, Hash, Building, Calendar, Gauge, Camera, AlertTriangle, Zap } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  WeighingRecord, 
  PhotoData, 
  VEHICLE_TYPES, 
  HARVESTS, 
  VehicleType, 
  WeightMethod,
  VEHICLE_CAPACITIES,
  PRODUCT_LOAD_FACTORS,
  WEIGHT_METHOD_LABELS
} from '@/types/weighing';
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

// Calculate estimated weight based on vehicle type and product
const calculateEstimatedWeight = (vehicleType: VehicleType, product: string) => {
  const capacity = VEHICLE_CAPACITIES[vehicleType];
  const factor = PRODUCT_LOAD_FACTORS[product] || 0.85;
  
  const estimatedNetWeight = capacity.loadCapacity * factor;
  const estimatedTare = capacity.avgTare;
  const estimatedGrossWeight = estimatedNetWeight + estimatedTare;
  
  return {
    estimatedNetWeight,
    estimatedTare,
    estimatedGrossWeight,
  };
};

export function WeighingForm({ isOffline, onSubmit }: WeighingFormProps) {
  const [vehiclePlatePhoto, setVehiclePlatePhoto] = useState<PhotoData | null>(null);
  const [tarePhoto, setTarePhoto] = useState<PhotoData | null>(null);
  const [productPhoto, setProductPhoto] = useState<PhotoData | null>(null);
  const [grossDisplayPhoto, setGrossDisplayPhoto] = useState<PhotoData | null>(null);
  const [tareDisplayPhoto, setTareDisplayPhoto] = useState<PhotoData | null>(null);
  
  const [weightMethod, setWeightMethod] = useState<WeightMethod>('scale');
  
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

  // Calculate estimated weights when in estimated mode
  const estimatedWeights = formData.vehicleType && formData.product
    ? calculateEstimatedWeight(formData.vehicleType as VehicleType, formData.product)
    : null;

  // Auto-fill weights when in estimated mode
  useEffect(() => {
    if (weightMethod === 'estimated' && estimatedWeights) {
      setFormData(prev => ({
        ...prev,
        grossWeight: estimatedWeights.estimatedGrossWeight.toFixed(3),
        tareWeight: estimatedWeights.estimatedTare.toFixed(3),
      }));
    }
  }, [weightMethod, formData.vehicleType, formData.product]);

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

  const handleGrossRecognized = (weight: number) => {
    setFormData(prev => ({ ...prev, grossWeight: weight.toFixed(3) }));
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
    
    // For estimated mode, vehicle type and product are required
    if (weightMethod === 'estimated') {
      if (!formData.vehicleType) {
        toast.error('Tipo do veículo é obrigatório para peso estimado');
        return false;
      }
      if (!formData.product) {
        toast.error('Produto é obrigatório para peso estimado');
        return false;
      }
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
      grossDisplayPhoto,
      tareDisplayPhoto,
    ].filter((p): p is PhotoData => p !== null);

    const now = new Date();
    const isEstimated = weightMethod === 'estimated';

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
      // Weight method
      weightMethod,
      isEstimated,
      estimatedReason: isEstimated ? 'Balança sem energia elétrica' : undefined,
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
    setGrossDisplayPhoto(null);
    setTareDisplayPhoto(null);
    setWeightMethod('scale');

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
              Tipo do Veículo {weightMethod === 'estimated' && '*'}
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

        {/* Weight Method Selector */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Modo de Pesagem</Label>
          <RadioGroup
            value={weightMethod}
            onValueChange={(value) => setWeightMethod(value as WeightMethod)}
            className="grid grid-cols-1 md:grid-cols-3 gap-3"
          >
            <div className={cn(
              "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
              weightMethod === 'scale' 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            )}>
              <RadioGroupItem value="scale" id="scale" />
              <Label htmlFor="scale" className="flex items-center gap-2 cursor-pointer flex-1">
                <Gauge className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">Balança</p>
                  <p className="text-xs text-muted-foreground">Digitação manual</p>
                </div>
              </Label>
            </div>
            <div className={cn(
              "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
              weightMethod === 'display_ocr' 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            )}>
              <RadioGroupItem value="display_ocr" id="display_ocr" />
              <Label htmlFor="display_ocr" className="flex items-center gap-2 cursor-pointer flex-1">
                <Camera className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium">Foto do Display</p>
                  <p className="text-xs text-muted-foreground">OCR automático</p>
                </div>
              </Label>
            </div>
            <div className={cn(
              "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
              weightMethod === 'estimated' 
                ? "border-status-syncing bg-status-syncing/5" 
                : "border-border hover:border-status-syncing/50"
            )}>
              <RadioGroupItem value="estimated" id="estimated" />
              <Label htmlFor="estimated" className="flex items-center gap-2 cursor-pointer flex-1">
                <AlertTriangle className="w-5 h-5 text-status-syncing" />
                <div>
                  <p className="font-medium">Peso Estimado</p>
                  <p className="text-xs text-muted-foreground">Sem energia/balança</p>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Estimated Mode Warning Banner */}
        {weightMethod === 'estimated' && (
          <div className="p-4 rounded-xl border-2 border-status-syncing/50 bg-status-syncing/10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-status-syncing shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-status-syncing">⚠️ MODO PESO ESTIMADO</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Peso calculado com base na capacidade do veículo ({formData.vehicleType ? VEHICLE_TYPES.find(t => t.value === formData.vehicleType)?.label : 'não selecionado'}) 
                  e fator de carga do produto ({formData.product || 'não selecionado'}).
                </p>
                {estimatedWeights && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-background/50 p-2 rounded">
                      <span className="text-muted-foreground block">Bruto Est.</span>
                      <span className="font-mono font-bold">{estimatedWeights.estimatedGrossWeight.toLocaleString('pt-BR')} kg</span>
                    </div>
                    <div className="bg-background/50 p-2 rounded">
                      <span className="text-muted-foreground block">Tara Est.</span>
                      <span className="font-mono font-bold">{estimatedWeights.estimatedTare.toLocaleString('pt-BR')} kg</span>
                    </div>
                    <div className="bg-background/50 p-2 rounded">
                      <span className="text-muted-foreground block">Líquido Est.</span>
                      <span className="font-mono font-bold text-status-syncing">{estimatedWeights.estimatedNetWeight.toLocaleString('pt-BR')} kg</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Display OCR Mode - Photo Buttons */}
        {weightMethod === 'display_ocr' && (
          <div className="p-4 rounded-xl border-2 border-blue-500/30 bg-blue-500/5">
            <div className="flex items-start gap-3 mb-4">
              <Camera className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-blue-500">MODO FOTO DO DISPLAY</p>
                <p className="text-sm text-muted-foreground">
                  Tire fotos do display da balança para reconhecimento automático via OCR.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  Foto Peso Bruto (Entrada)
                </Label>
                <CategoryPhotoCapture
                  category="tare"
                  photo={grossDisplayPhoto}
                  onPhotoChange={setGrossDisplayPhoto}
                  onWeightRecognized={handleGrossRecognized}
                  label="peso bruto"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  Foto Tara (Saída)
                </Label>
                <CategoryPhotoCapture
                  category="tare"
                  photo={tareDisplayPhoto}
                  onPhotoChange={setTareDisplayPhoto}
                  onWeightRecognized={handleTareRecognized}
                  onBothWeightsRecognized={handleBothWeightsRecognized}
                  label="tara"
                />
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Scale Number - only show for scale mode */}
          {weightMethod === 'scale' && (
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
          )}

          {/* Empty cell for alignment when scale mode */}
          {weightMethod === 'scale' && <div className="hidden md:block" />}

          {/* Gross Weight */}
          <div className="space-y-2">
            <Label htmlFor="grossWeight" className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              Peso Bruto - Entrada (kg) *
              {weightMethod === 'estimated' && (
                <span className="text-xs text-status-syncing font-normal">(estimado)</span>
              )}
              {weightMethod === 'display_ocr' && (
                <span className="text-xs text-blue-500 font-normal">(via OCR)</span>
              )}
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
              className={cn(
                "font-mono text-lg",
                weightMethod === 'estimated' && "bg-status-syncing/10 border-status-syncing/30"
              )}
              readOnly={weightMethod === 'estimated'}
            />
          </div>

          {/* Tare Weight */}
          <div className="space-y-2">
            <Label htmlFor="tareWeight" className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              Tara - Saída (kg) *
              {weightMethod === 'estimated' && (
                <span className="text-xs text-status-syncing font-normal">(estimado)</span>
              )}
              {weightMethod === 'display_ocr' && (
                <span className="text-xs text-blue-500 font-normal">(via OCR)</span>
              )}
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
                className={cn(
                  "font-mono text-lg flex-1",
                  weightMethod === 'estimated' && "bg-status-syncing/10 border-status-syncing/30"
                )}
                readOnly={weightMethod === 'estimated'}
              />
              {weightMethod === 'scale' && (
                <CategoryPhotoCapture
                  category="tare"
                  photo={tarePhoto}
                  onPhotoChange={setTarePhoto}
                  onWeightRecognized={handleTareRecognized}
                  onBothWeightsRecognized={handleBothWeightsRecognized}
                  label="tara/pbt"
                />
              )}
            </div>
          </div>

          {/* Net Weight Display */}
          <div className="md:col-span-2">
            <div className={cn(
              'p-4 rounded-xl border-2 border-dashed',
              weightMethod === 'estimated' 
                ? 'bg-status-syncing/5 border-status-syncing/30'
                : 'bg-primary/5 border-primary/30'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground font-medium">
                    Peso Líquido
                    {weightMethod === 'estimated' && (
                      <span className="ml-2 text-xs bg-status-syncing/20 text-status-syncing px-2 py-0.5 rounded-full">
                        ESTIMADO
                      </span>
                    )}
                  </span>
                  <p className="text-xs text-muted-foreground">Peso Bruto − Tara</p>
                </div>
                <span className={cn(
                  "text-3xl font-mono font-bold",
                  weightMethod === 'estimated' ? "text-status-syncing" : "text-primary"
                )}>
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
          isOffline && 'bg-status-offline hover:bg-status-offline/90',
          weightMethod === 'estimated' && 'bg-status-syncing hover:bg-status-syncing/90'
        )}
      >
        <Save className="w-5 h-5" />
        {weightMethod === 'estimated' 
          ? 'Registrar Peso Estimado'
          : isOffline 
            ? 'Salvar Localmente' 
            : 'Registrar Pesagem'}
      </Button>
    </form>
  );
}
