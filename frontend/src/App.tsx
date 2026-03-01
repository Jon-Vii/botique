import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { ListingDetail } from "./pages/ListingDetail";
import { Marketplace } from "./pages/Marketplace";
import { ShopDetail } from "./pages/ShopDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 4000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="shop/:shopId" element={<ShopDetail />} />
            <Route path="listing/:listingId" element={<ListingDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
