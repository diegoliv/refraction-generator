import { type ChangeEvent, useRef } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';

type BackgroundImageFieldProps = {
  imageSrc: string;
  onChange: (src: string) => void;
};

export function BackgroundImageField({ imageSrc, onChange }: BackgroundImageFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="space-y-2 py-1">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => inputRef.current?.click()}>
          <ImagePlus />
          {imageSrc ? 'Replace image' : 'Upload image'}
        </Button>
        {imageSrc ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')}>
            <Trash2 />
            Remove
          </Button>
        ) : null}
      </div>
      {imageSrc ? (
        <div className="overflow-hidden rounded-md border border-border/70 bg-input/40">
          <img src={imageSrc} alt="Background preview" className="h-28 w-full object-cover" />
        </div>
      ) : (
        <p className="text-[10px] leading-4 text-muted-foreground">Upload an image to replace the gradient background.</p>
      )}
    </div>
  );
}

