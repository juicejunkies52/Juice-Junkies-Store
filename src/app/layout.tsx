import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/contexts/CartContext";
import CartSidebar from "@/components/cart/CartSidebar";

export const metadata: Metadata = {
  title: "Juice Junkies Store | Premium Fan Merchandise",
  description: "Premium fan merchandise and streetwear inspired by Juice WRLD culture. Quality apparel for true fans. 999 Forever.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <CartProvider>
          {children}
          <CartSidebar />
        </CartProvider>
      </body>
    </html>
  );
}
