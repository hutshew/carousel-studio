import './globals.css';

export const metadata = {
  title: 'Carousel Studio',
  description: 'Create seamless social media carousels in your browser',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
