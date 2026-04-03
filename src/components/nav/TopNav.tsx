'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  Hammer,
  Ruler,
  Layers,
  Building2,
  Wrench,
  Menu,
  X,
  PackageCheck,
  Warehouse,
  ClipboardList,
  Truck,
  ShoppingCart,
  MapPin,
  Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  userName?: string | null;
  userRole?: string;
}

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: '/all-bids',  label: 'Bids',       icon: <FolderOpen className="w-4 h-4" /> },
  { href: '/designs',   label: 'Designs',    icon: <Ruler className="w-4 h-4" /> },
  { href: '/ewp',       label: 'EWP',        icon: <Layers className="w-4 h-4" /> },
  { href: '/projects',  label: 'Projects',   icon: <Building2 className="w-4 h-4" /> },
  { href: '/it-issues', label: 'IT Issues',  icon: <Wrench className="w-4 h-4" /> },
  { href: '/purchasing', label: 'Purchasing', icon: <PackageCheck className="w-4 h-4" /> },
  { href: '/warehouse',   label: 'Warehouse',   icon: <Warehouse className="w-4 h-4" /> },
  { href: '/work-orders', label: 'Work Orders', icon: <ClipboardList className="w-4 h-4" /> },
  { href: '/dispatch',   label: 'Dispatch',    icon: <Truck className="w-4 h-4" /> },
  { href: '/delivery',   label: 'Delivery',    icon: <MapPin className="w-4 h-4" /> },
  { href: '/sales',      label: 'Sales',       icon: <ShoppingCart className="w-4 h-4" /> },
  { href: '/supervisor', label: 'Supervisor',  icon: <Users className="w-4 h-4" /> },
  { href: '/',           label: 'Estimating',  icon: <FileText className="w-4 h-4" /> },
  { href: '/takeoff',   label: 'PDF Takeoff', icon: <Hammer className="w-4 h-4" /> },
];

const ADMIN_LINKS = [
  { href: '/admin',                label: 'Dashboard' },
  { href: '/admin/customers',      label: 'Customers' },
  { href: '/admin/products',       label: 'Products / SKUs' },
  { href: '/admin/formulas',       label: 'Formulas' },
  { href: '/admin/users',          label: 'Users' },
  { href: '/admin/bid-fields',     label: 'Bid Fields' },
  { href: '/admin/notifications',  label: 'Notifications' },
  { href: '/admin/audit',          label: 'Audit Log' },
  { href: '/admin/erp',            label: 'ERP Sync' },
  { href: '/purchasing/review',         label: 'PO Review' },
  { href: '/ops/delivery-reporting',    label: 'Delivery Report' },
  { href: '/warehouse/pickers',         label: 'Picker Admin' },
];

// Sub-nav groups for domains with multiple pages
const WAREHOUSE_LINKS = [
  { href: '/warehouse',             label: 'Picks Board' },
  { href: '/warehouse/open-picks',  label: 'Open Picks' },
  { href: '/warehouse/picker-stats',label: 'Picker Stats' },
];

const SALES_LINKS = [
  { href: '/sales',               label: 'Sales Hub' },
  { href: '/sales/transactions',  label: 'Transactions' },
  { href: '/sales/history',       label: 'Purchase History' },
  { href: '/sales/products',      label: 'Products & Stock' },
  { href: '/sales/reports',       label: 'Reports' },
];

const PURCHASING_LINKS = [
  { href: '/purchasing',           label: 'PO Check-In' },
  { href: '/purchasing/open-pos',  label: 'Open POs' },
  { href: '/purchasing/review',    label: 'Review Queue' },
];

const DELIVERY_LINKS = [
  { href: '/delivery',     label: 'Delivery Tracker' },
  { href: '/delivery/map', label: 'Fleet Map' },
];

export function TopNav({ userName, userRole }: Props) {
  const pathname = usePathname();
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [warehouseOpen, setWarehouseOpen] = React.useState(false);
  const [salesOpen, setSalesOpen] = React.useState(false);
  const [purchasingOpen, setPurchasingOpen] = React.useState(false);
  const [deliveryOpen, setDeliveryOpen] = React.useState(false);
  const adminRef = React.useRef<HTMLDivElement>(null);
  const warehouseRef = React.useRef<HTMLDivElement>(null);
  const salesRef = React.useRef<HTMLDivElement>(null);
  const purchasingRef = React.useRef<HTMLDivElement>(null);
  const deliveryRef = React.useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) setAdminOpen(false);
      if (warehouseRef.current && !warehouseRef.current.contains(e.target as Node)) setWarehouseOpen(false);
      if (salesRef.current && !salesRef.current.contains(e.target as Node)) setSalesOpen(false);
      if (purchasingRef.current && !purchasingRef.current.contains(e.target as Node)) setPurchasingOpen(false);
      if (deliveryRef.current && !deliveryRef.current.contains(e.target as Node)) setDeliveryOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLink = (href: string, label: string, icon?: React.ReactNode) => (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
        pathname === href
          ? 'bg-cyan-500/20 text-cyan-400'
          : 'text-slate-300 hover:text-white hover:bg-slate-800'
      )}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <>
      <nav className="sticky top-0 z-50 bg-slate-950/90 border-b border-white/10 backdrop-blur-sm print:hidden">
        <div className="max-w-8xl mx-auto px-4 flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-white font-bold text-lg flex-shrink-0">
              <Hammer className="w-5 h-5 text-cyan-400" />
              <span>Live<span className="text-cyan-400">Edge</span></span>
            </Link>

            {/* Desktop main nav */}
            <div className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.filter((l) => !['Warehouse', 'Sales', 'Purchasing', 'Delivery'].includes(l.label)).map((l) => (
                <React.Fragment key={l.href}>
                  {navLink(l.href, l.label, l.icon)}
                </React.Fragment>
              ))}

              {/* Warehouse dropdown */}
              <div className="relative" ref={warehouseRef}>
                <button
                  onClick={() => setWarehouseOpen(!warehouseOpen)}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
                    pathname.startsWith('/warehouse') ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:text-white hover:bg-slate-800')}
                >
                  <Warehouse className="w-4 h-4" /><span>Warehouse</span>
                  <ChevronDown className={cn('w-3 h-3 transition', warehouseOpen && 'rotate-180')} />
                </button>
                {warehouseOpen && (
                  <div className="absolute left-0 mt-1 w-44 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                    {WAREHOUSE_LINKS.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setWarehouseOpen(false)}
                        className={cn('block px-4 py-2.5 text-sm transition', pathname === item.href ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white')}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Sales dropdown */}
              <div className="relative" ref={salesRef}>
                <button
                  onClick={() => setSalesOpen(!salesOpen)}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
                    pathname.startsWith('/sales') ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:text-white hover:bg-slate-800')}
                >
                  <ShoppingCart className="w-4 h-4" /><span>Sales</span>
                  <ChevronDown className={cn('w-3 h-3 transition', salesOpen && 'rotate-180')} />
                </button>
                {salesOpen && (
                  <div className="absolute left-0 mt-1 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                    {SALES_LINKS.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setSalesOpen(false)}
                        className={cn('block px-4 py-2.5 text-sm transition', pathname === item.href ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white')}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Purchasing dropdown */}
              <div className="relative" ref={purchasingRef}>
                <button
                  onClick={() => setPurchasingOpen(!purchasingOpen)}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
                    pathname.startsWith('/purchasing') ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:text-white hover:bg-slate-800')}
                >
                  <PackageCheck className="w-4 h-4" /><span>Purchasing</span>
                  <ChevronDown className={cn('w-3 h-3 transition', purchasingOpen && 'rotate-180')} />
                </button>
                {purchasingOpen && (
                  <div className="absolute left-0 mt-1 w-44 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                    {PURCHASING_LINKS.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setPurchasingOpen(false)}
                        className={cn('block px-4 py-2.5 text-sm transition', pathname === item.href ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white')}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery dropdown */}
              <div className="relative" ref={deliveryRef}>
                <button
                  onClick={() => setDeliveryOpen(!deliveryOpen)}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
                    pathname.startsWith('/delivery') ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:text-white hover:bg-slate-800')}
                >
                  <MapPin className="w-4 h-4" /><span>Delivery</span>
                  <ChevronDown className={cn('w-3 h-3 transition', deliveryOpen && 'rotate-180')} />
                </button>
                {deliveryOpen && (
                  <div className="absolute left-0 mt-1 w-44 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                    {DELIVERY_LINKS.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setDeliveryOpen(false)}
                        className={cn('block px-4 py-2.5 text-sm transition', pathname === item.href ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white')}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Admin dropdown — desktop only */}
            {userRole === 'admin' && (
              <div className="relative hidden lg:block" ref={adminRef}>
                <button
                  onClick={() => setAdminOpen(!adminOpen)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
                    pathname.startsWith('/admin')
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  )}
                >
                  <Settings className="w-4 h-4" />
                  <span>Admin</span>
                  <ChevronDown className={cn('w-3 h-3 transition', adminOpen && 'rotate-180')} />
                </button>

                {adminOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                    {ADMIN_LINKS.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setAdminOpen(false)}
                        className={cn(
                          'block px-4 py-2.5 text-sm transition',
                          pathname === item.href
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* User info + logout — desktop */}
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-700">
              <span className="text-sm text-slate-400">{userName ?? 'User'}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col print:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* Panel */}
          <div className="relative mt-14 bg-slate-900 border-b border-white/10 shadow-xl overflow-y-auto max-h-[calc(100vh-3.5rem)]">
            <div className="px-4 py-3 space-y-1">
              {NAV_LINKS.filter((l) => !['Warehouse', 'Sales', 'Purchasing', 'Delivery'].includes(l.label)).map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
                    pathname === l.href
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  )}
                >
                  {l.icon}
                  {l.label}
                </Link>
              ))}

              {/* Warehouse sub-links */}
              <div className="pt-1 pb-0.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Warehouse</div>
              {WAREHOUSE_LINKS.map((item) => (
                <Link key={item.href} href={item.href}
                  className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition',
                    pathname === item.href ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800')}>
                  <Warehouse className="w-3.5 h-3.5" />{item.label}
                </Link>
              ))}

              {/* Sales sub-links */}
              <div className="pt-1 pb-0.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sales</div>
              {SALES_LINKS.map((item) => (
                <Link key={item.href} href={item.href}
                  className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition',
                    pathname === item.href ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800')}>
                  <ShoppingCart className="w-3.5 h-3.5" />{item.label}
                </Link>
              ))}

              {/* Purchasing sub-links */}
              <div className="pt-1 pb-0.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Purchasing</div>
              {PURCHASING_LINKS.map((item) => (
                <Link key={item.href} href={item.href}
                  className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition',
                    pathname === item.href ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800')}>
                  <PackageCheck className="w-3.5 h-3.5" />{item.label}
                </Link>
              ))}

              {/* Delivery sub-links */}
              <div className="pt-1 pb-0.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Delivery</div>
              {DELIVERY_LINKS.map((item) => (
                <Link key={item.href} href={item.href}
                  className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition',
                    pathname === item.href ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-slate-800')}>
                  <MapPin className="w-3.5 h-3.5" />{item.label}
                </Link>
              ))}

              {userRole === 'admin' && (
                <>
                  <div className="pt-2 pb-1 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Admin
                  </div>
                  {ADMIN_LINKS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
                        pathname === item.href
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      )}
                    >
                      <Settings className="w-4 h-4 text-slate-500" />
                      {item.label}
                    </Link>
                  ))}
                </>
              )}

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between px-3 py-2.5">
                <span className="text-sm text-slate-400">{userName ?? 'User'}</span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
