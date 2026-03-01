import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Benchmarks } from "./pages/Benchmarks";
import { Dashboard } from "./pages/Dashboard";
import { ListingDetail } from "./pages/ListingDetail";
import { Marketplace } from "./pages/Marketplace";
import { ShopDetail } from "./pages/ShopDetail";
import { Operator } from "./pages/Operator";
import { NotFound } from "./pages/NotFound";
import { RunList } from "./pages/RunList";
import { RunDetail } from "./pages/RunDetail";
import { TournamentList } from "./pages/TournamentList";
import { TournamentDetail } from "./pages/TournamentDetail";

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
            <Route path="runs" element={<RunList />} />
            <Route path="runs/:runId" element={<RunDetail />} />
            <Route path="benchmarks" element={<Benchmarks />} />
            <Route path="tournaments" element={<TournamentList />} />
            <Route path="tournaments/:tournamentId" element={<TournamentDetail />} />
            <Route path="operator" element={<Operator />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
