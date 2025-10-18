import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const PaymentSettings = () => {
  const [uploading, setUploading] = useState(false);
  const [currentQrCode, setCurrentQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentQrCode();
  }, []);

  const loadCurrentQrCode = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_qr_codes')
        .select('image_url')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading QR code:', error);
      } else if (data) {
        setCurrentQrCode(data.image_url);
      }
    } catch (error) {
      console.error('Error in loadCurrentQrCode:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `qr-code-${Date.now()}.${fileExt}`;
      const filePath = `payment-qr/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-images')
        .upload(filePath, selectedFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload image');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('payment-images')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('payment_qr_codes')
        .insert({
          image_url: urlData.publicUrl,
          is_active: true
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        toast.error('Failed to save QR code');
        return;
      }

      setCurrentQrCode(urlData.publicUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      toast.success('QR code uploaded successfully');
    } catch (error) {
      console.error('Error in handleUpload:', error);
      toast.error('An error occurred while uploading');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment QR Code</CardTitle>
        <CardDescription>
          Upload a QR code image for customers to make payments. Only one QR code can be active at a time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentQrCode && (
          <div className="space-y-2">
            <Label>Current QR Code</Label>
            <div className="border rounded-lg p-4 bg-muted/30">
              <img
                src={currentQrCode}
                alt="Payment QR Code"
                className="max-w-xs mx-auto"
              />
            </div>
          </div>
        )}

        <div className="space-y-4">
          <Label>Upload New QR Code</Label>
          <div className="border-2 border-dashed rounded-lg p-6">
            {previewUrl ? (
              <div className="space-y-4">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-xs mx-auto"
                />
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <Label htmlFor="qr-upload" className="cursor-pointer">
                    <div className="text-sm text-muted-foreground">
                      Click to select or drag and drop
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      PNG, JPG or JPEG (max 5MB)
                    </div>
                  </Label>
                  <Input
                    id="qr-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
                <Button variant="outline" onClick={() => document.getElementById('qr-upload')?.click()}>
                  Select File
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
