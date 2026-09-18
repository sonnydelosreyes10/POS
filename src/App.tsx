import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useStore } from './app/store';
import { AppShell } from './components/AppShell';
import { LoginScreen } from './screens/pos/LoginScreen';
import { PosScreen } from './screens/pos/PosScreen';
import { PaymentScreen } from './screens/pos/PaymentScreen';
import { ReturnsScreen } from './screens/pos/ReturnsScreen';
import { ShiftCloseScreen } from './screens/pos/ShiftCloseScreen';
import { DashboardScreen } from './screens/backoffice/DashboardScreen';
import { InventoryScreen } from './screens/backoffice/InventoryScreen';
import { StockCardScreen } from './screens/backoffice/StockCardScreen';
import { PhysicalCountScreen } from './screens/backoffice/PhysicalCountScreen';
import { AdjustStockScreen } from './screens/backoffice/AdjustStockScreen';
import { PurchasingScreen } from './screens/backoffice/PurchasingScreen';
import { ReportsScreen } from './screens/backoffice/ReportsScreen';
import { MaintenanceScreen } from './screens/backoffice/MaintenanceScreen';

/** Cashier cannot reach the sales screen without signing in and opening a shift — FR-SHF-01. */
function RequireShift() {
  const { state } = useStore();
  if (!state.user || !state.shiftOpen) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Back office requires sign-in. Role checks belong on the server (NFR-04). */
function RequireUser() {
  const { state } = useStore();
  if (!state.user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/login" element={<LoginScreen />} />
        <Route element={<RequireShift />}>
          <Route path="/pos" element={<PosScreen />} />
          <Route path="/pos/pay" element={<PaymentScreen />} />
          <Route path="/pos/returns" element={<ReturnsScreen />} />
          <Route path="/shift/close" element={<ShiftCloseScreen />} />
        </Route>
        <Route path="/admin" element={<RequireUser />}>
          <Route index element={<DashboardScreen />} />
          <Route path="inventory" element={<InventoryScreen />} />
          <Route path="inventory/count" element={<PhysicalCountScreen />} />
          <Route path="inventory/:sku" element={<StockCardScreen />} />
          <Route path="inventory/:sku/adjust" element={<AdjustStockScreen />} />
          <Route path="purchasing" element={<PurchasingScreen />} />
          <Route path="reports" element={<ReportsScreen />} />
          <Route path="maintenance" element={<MaintenanceScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Route>
    </Routes>
  );
}
