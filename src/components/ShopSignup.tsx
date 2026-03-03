import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Wrench, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';

interface ShopSignupProps {
  onBack: () => void;
}

export function ShopSignup({ onBack }: ShopSignupProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    shopName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    businessAddress: '',
    businessType: 'independent',
    numberOfBays: 2
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('shop_signup_requests')
        .insert({
          shop_name: formData.shopName.trim(),
          owner_name: formData.ownerName.trim(),
          owner_email: formData.ownerEmail.trim().toLowerCase(),
          owner_phone: formData.ownerPhone.trim() || null,
          business_address: formData.businessAddress.trim() || null,
          business_type: formData.businessType,
          number_of_bays: formData.numberOfBays,
          status: 'pending'
        });

      if (insertError) throw insertError;

      setStep('success');
    } catch (err) {
      console.error('Signup error:', err);
      setError('Failed to submit signup request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 md:p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Request Received!
          </h1>

          <p className="text-lg text-slate-600 mb-8">
            Thank you for your interest in ShopManager Pro. We've received your signup request and our team will review it shortly.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-slate-900 mb-3">What happens next?</h3>
            <ol className="text-left text-slate-700 space-y-2">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</span>
                <span>We'll review your application within 24 hours</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</span>
                <span>You'll receive an email with your account credentials</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</span>
                <span>Log in and start your 30-day free trial immediately</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">4</span>
                <span>Our team will help you get set up and answer any questions</span>
              </li>
            </ol>
          </div>

          <p className="text-slate-600 mb-6">
            We sent a confirmation email to <span className="font-semibold text-slate-900">{formData.ownerEmail}</span>
          </p>

          <button
            onClick={onBack}
            className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:border-slate-400 font-medium inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 text-slate-600 hover:text-slate-900 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Wrench className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Start Your Free Trial</h1>
          </div>

          <p className="text-center text-slate-600 mb-8">
            Tell us about your shop and we'll set up your account. Your 30-day free trial starts immediately after approval.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Shop Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.shopName}
                  onChange={(e) => updateFormData('shopName', e.target.value)}
                  placeholder="e.g., Mike's Auto Service"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.ownerName}
                  onChange={(e) => updateFormData('ownerName', e.target.value)}
                  placeholder="e.g., Mike Johnson"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.ownerEmail}
                  onChange={(e) => updateFormData('ownerEmail', e.target.value)}
                  placeholder="you@yourshop.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.ownerPhone}
                  onChange={(e) => updateFormData('ownerPhone', e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Business Address
              </label>
              <input
                type="text"
                value={formData.businessAddress}
                onChange={(e) => updateFormData('businessAddress', e.target.value)}
                placeholder="123 Main St, City, State ZIP"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Business Type
                </label>
                <select
                  value={formData.businessType}
                  onChange={(e) => updateFormData('businessType', e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="independent">Independent Shop</option>
                  <option value="franchise">Franchise</option>
                  <option value="dealership">Dealership</option>
                  <option value="fleet">Fleet Service</option>
                  <option value="mobile">Mobile Mechanic</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Number of Service Bays
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.numberOfBays}
                  onChange={(e) => updateFormData('numberOfBays', parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                What's Included in Your Free Trial
              </h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Full access to all features for 30 days
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  No credit card required
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Personal onboarding and setup assistance
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Cancel anytime, no questions asked
                </li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Start My Free Trial
                </>
              )}
            </button>

            <p className="text-center text-sm text-slate-500">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
