import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from '@/app/layout/main-layout';
import { AuthLayout } from '@/app/layout/auth-layout';
import { HomePage } from '@/pages/home';
import { RecordPage } from '@/pages/record';
import { DiscoverPage } from '@/pages/discover';
import { ProfilePage } from '@/pages/profile';
import { LoginPage } from '@/pages/auth/login';
import { RegisterPage } from '@/pages/auth/register';
import { WechatCallbackPage } from '@/pages/auth/wechat-callback';
import { BabyPage } from '@/pages/baby';
import { FamilyPage } from '@/pages/family';
import { GrowthPage } from '@/pages/growth';
import { VaccinePage } from '@/pages/vaccine';
import { MilestonePage } from '@/pages/milestone';
import { AiAssistantPage } from '@/pages/ai-assistant';
import { JaundicePage } from '@/pages/jaundice';
import { ReportPage } from '@/pages/report';
import { SettingsPage } from '@/pages/settings';

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/record', element: <RecordPage /> },
      { path: '/discover', element: <DiscoverPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/baby', element: <BabyPage /> },
      { path: '/family', element: <FamilyPage /> },
      { path: '/growth', element: <GrowthPage /> },
      { path: '/vaccine', element: <VaccinePage /> },
      { path: '/milestone', element: <MilestonePage /> },
      { path: '/ai-assistant', element: <AiAssistantPage /> },
      { path: '/jaundice', element: <JaundicePage /> },
      { path: '/report', element: <ReportPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/auth/wechat/callback', element: <WechatCallbackPage /> },
    ],
  },
]);
