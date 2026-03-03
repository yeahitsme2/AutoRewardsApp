import { useState } from 'react';
import {
  Wrench,
  Calendar,
  MessageSquare,
  Package,
  TrendingUp,
  Shield,
  Smartphone,
  CheckCircle,
  ArrowRight,
  Star,
  Users,
  Clock,
  DollarSign,
  Zap,
  BarChart3,
  Gift,
  FileText,
  Camera
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  const features = [
    {
      icon: Calendar,
      title: 'Smart Scheduling',
      description: 'Online booking, appointment management, and automated reminders keep your bays full and customers informed.'
    },
    {
      icon: FileText,
      title: 'Digital Inspections',
      description: 'Complete vehicle inspections with photos and videos. Send professional reports directly to customers for instant approval.'
    },
    {
      icon: Wrench,
      title: 'Repair Order Management',
      description: 'Create, track, and manage repair orders with automatic markup rules, labor calculations, and customer approvals.'
    },
    {
      icon: Package,
      title: 'Inventory Control',
      description: 'Track parts, manage purchase orders, scan barcodes, and automate reordering to never run out of critical items.'
    },
    {
      icon: MessageSquare,
      title: 'Customer Communication',
      description: 'Built-in messaging, SMS notifications, and real-time updates keep customers in the loop every step of the way.'
    },
    {
      icon: Gift,
      title: 'Loyalty & Rewards',
      description: 'Automated loyalty program with points, tiers, and rewards that brings customers back and increases lifetime value.'
    },
    {
      icon: TrendingUp,
      title: 'Business Analytics',
      description: 'Real-time dashboards, revenue tracking, and performance metrics to make data-driven decisions.'
    },
    {
      icon: Smartphone,
      title: 'Mobile Ready',
      description: 'Native mobile apps for iOS and Android. Manage your shop from anywhere, anytime.'
    }
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: billingInterval === 'monthly' ? 99 : 990,
      description: 'Perfect for small shops getting started',
      features: [
        'Up to 3 service bays',
        '500 repair orders/month',
        'Digital vehicle inspections',
        'Appointment scheduling',
        'Customer messaging',
        'Basic inventory management',
        'Loyalty program',
        'Mobile apps'
      ],
      highlighted: false
    },
    {
      name: 'Professional',
      price: billingInterval === 'monthly' ? 199 : 1990,
      description: 'For growing shops that need more power',
      features: [
        'Up to 10 service bays',
        'Unlimited repair orders',
        'Advanced DVI with video',
        'Multi-location support',
        'Advanced analytics',
        'Full inventory suite',
        'Custom markup rules',
        'Priority support',
        'Everything in Starter'
      ],
      highlighted: true
    },
    {
      name: 'Enterprise',
      price: null,
      description: 'Custom solutions for large operations',
      features: [
        'Unlimited bays & locations',
        'Unlimited everything',
        'API access',
        'Custom integrations',
        'Dedicated account manager',
        'White-label options',
        'SLA guarantees',
        '24/7 phone support'
      ],
      highlighted: false
    }
  ];

  const testimonials = [
    {
      name: 'Mike Johnson',
      role: 'Owner, Mike\'s Auto Service',
      content: 'This platform transformed how we run our shop. Customer satisfaction is up 40% and we\'ve cut paperwork time in half.',
      rating: 5
    },
    {
      name: 'Sarah Chen',
      role: 'Service Manager, Premium Auto Care',
      content: 'The digital inspections feature alone paid for itself in the first month. Customers love seeing exactly what their car needs.',
      rating: 5
    },
    {
      name: 'David Martinez',
      role: 'Owner, Martinez Motors',
      content: 'Best investment we\'ve made. The loyalty program has customers coming back regularly and the analytics help us plan better.',
      rating: 5
    }
  ];

  const stats = [
    { number: '500+', label: 'Auto Shops' },
    { number: '50K+', label: 'Customers Served' },
    { number: '99.9%', label: 'Uptime' },
    { number: '4.9/5', label: 'Customer Rating' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Wrench className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-slate-900">ShopManager Pro</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-600 hover:text-slate-900">Features</a>
              <a href="#pricing" className="text-slate-600 hover:text-slate-900">Pricing</a>
              <a href="#testimonials" className="text-slate-600 hover:text-slate-900">Testimonials</a>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/app');
                  window.location.reload();
                }}
                className="text-slate-600 hover:text-slate-900 font-medium"
              >
                Sign In
              </button>
              <button
                onClick={onGetStarted}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Start Free Trial
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
              Run Your Auto Shop Like a Pro
            </h1>
            <p className="text-xl text-slate-600 mb-8">
              All-in-one platform to manage appointments, inspections, repairs, inventory, and customer relationships. Streamline operations and grow your business.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={onGetStarted}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg flex items-center gap-2"
              >
                Start 30-Day Free Trial
                <ArrowRight className="w-5 h-5" />
              </button>
              <a href="#features" className="px-8 py-4 border-2 border-slate-300 text-slate-700 rounded-lg hover:border-slate-400 font-semibold text-lg">
                See How It Works
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-500">No credit card required • Setup in 5 minutes • Cancel anytime</p>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">{stat.number}</div>
                <div className="text-slate-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Everything You Need to Succeed</h2>
            <p className="text-xl text-slate-600">Powerful features designed specifically for auto repair shops</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="p-6 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all">
                <feature.icon className="w-10 h-10 text-blue-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Simple Process, Powerful Results</h2>
            <p className="text-xl text-slate-600">Get up and running in minutes</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Sign Up</h3>
              <p className="text-slate-600">Create your account and tell us about your shop. Takes less than 5 minutes.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Customize</h3>
              <p className="text-slate-600">Set up your services, pricing, and team. Import existing customer data if needed.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Start Growing</h3>
              <p className="text-slate-600">Begin taking appointments, managing repairs, and delighting customers immediately.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-slate-600 mb-8">Choose the plan that fits your shop size</p>

            <div className="inline-flex items-center gap-4 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setBillingInterval('monthly')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  billingInterval === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('annual')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  billingInterval === 'annual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Annual <span className="text-green-600 text-sm ml-1">(Save 17%)</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'bg-blue-600 text-white shadow-2xl scale-105'
                    : 'bg-white border-2 border-slate-200'
                }`}
              >
                {plan.highlighted && (
                  <div className="text-center mb-4">
                    <span className="px-3 py-1 bg-white text-blue-600 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className={`text-2xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-slate-900'}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm mb-4 ${plan.highlighted ? 'text-blue-100' : 'text-slate-600'}`}>
                    {plan.description}
                  </p>
                  <div className="mb-2">
                    {plan.price !== null ? (
                      <>
                        <span className="text-5xl font-bold">${plan.price}</span>
                        <span className={`text-lg ${plan.highlighted ? 'text-blue-100' : 'text-slate-600'}`}>
                          /{billingInterval === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      </>
                    ) : (
                      <span className="text-4xl font-bold">Custom</span>
                    )}
                  </div>
                  {billingInterval === 'annual' && plan.price !== null && (
                    <p className={`text-sm ${plan.highlighted ? 'text-blue-100' : 'text-slate-500'}`}>
                      ${(plan.price / 12).toFixed(0)}/month billed annually
                    </p>
                  )}
                </div>

                <button
                  onClick={onGetStarted}
                  className={`w-full py-3 rounded-lg font-semibold mb-6 ${
                    plan.highlighted
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {plan.price !== null ? 'Start Free Trial' : 'Contact Sales'}
                </button>

                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <CheckCircle className={`w-5 h-5 flex-shrink-0 ${plan.highlighted ? 'text-blue-200' : 'text-green-600'}`} />
                      <span className={`text-sm ${plan.highlighted ? 'text-blue-50' : 'text-slate-600'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Loved by Auto Shop Owners</h2>
            <p className="text-xl text-slate-600">See what shop owners are saying</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-700 mb-6 leading-relaxed">{testimonial.content}</p>
                <div>
                  <div className="font-semibold text-slate-900">{testimonial.name}</div>
                  <div className="text-sm text-slate-600">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Transform Your Shop?</h2>
          <p className="text-xl mb-8 text-blue-100">
            Join hundreds of auto shops already streamlining their operations and growing their business.
          </p>
          <button
            onClick={onGetStarted}
            className="px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-blue-50 font-semibold text-lg flex items-center gap-2 mx-auto"
          >
            Start Your 30-Day Free Trial
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="mt-4 text-blue-100">No credit card required • Full access to all features • Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Wrench className="w-6 h-6 text-blue-500" />
                <span className="text-lg font-bold text-white">ShopManager Pro</span>
              </div>
              <p className="text-sm">
                Modern shop management software built for auto repair professionals.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><a href="#testimonials" className="hover:text-white">Testimonials</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/legal.html" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="/legal.html" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-12 pt-8 text-center text-sm">
            <p>© 2024 ShopManager Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
