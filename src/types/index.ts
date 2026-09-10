export interface BotConfig {
  botToken: string;
  adminIds: bigint[];
  paymentPhone: string;
  paymentDetails: string;
}

export interface ProductView {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  stock: number;
  isActive: boolean;
  categoryId: number;
}

export interface CourseView {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  items: {
    productId: number;
    productName: string;
    quantity: number;
  }[];
}

export interface CartViewItem {
  cartItemId: number;
  type: "product" | "course";
  id: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface CartView {
  items: CartViewItem[];
  total: number;
}

export interface OrderView {
  id: number;
  total: number;
  status: string;
  paymentStatus: string;
  fullName: string | null;
  region: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  createdAt: Date;
  items: OrderItemView[];
}

export interface OrderItemView {
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface SendMessageResult {
  messageId: number;
}
