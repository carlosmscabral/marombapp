import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Analytics } from './screens/Analytics';
import { Plan } from './screens/Plan';
import { Library } from './screens/Library';
import { InGym } from './screens/InGym';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/library" element={<Library />} />
          <Route path="/in-gym" element={<InGym />} />
          <Route path="/" element={<Navigate to="/analytics" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
