import * as React from "react";
import dayjs from "dayjs";

interface EmailTemplateProps {
  productList: {
    productCode: string;
    quantity: number;
    date: string;
    regularizationDate: string;
  }[];
}

export const EmailTemplate: React.FC<Readonly<EmailTemplateProps>> = ({ productList }) => {
  // Styles for the template
  const styles = {
    container: {
      fontFamily: "Arial, sans-serif",
      padding: "20px",
      backgroundColor: "#f9f9f9",
      borderRadius: "8px",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    },
    title: {
      color: "#333",
      borderBottom: "2px solid #007bff",
      paddingBottom: "10px",
      marginBottom: "20px",
    },
    productItem: {
      padding: "15px",
      border: "1px solid #ddd",
      borderRadius: "8px",
      marginBottom: "15px",
      backgroundColor: "#fff",
    },
    productCode: {
      color: "#007bff",
      marginBottom: "10px",
      fontWeight: "bold",
    },
    productDetail: {
      margin: "5px 0",
      color: "#555",
    },
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Listado de productos</h3>
      {productList.map((product, index) => (
        <div key={index} style={styles.productItem}>
          <h3 style={styles.productCode}>Producto: {product.productCode}</h3>
          <p style={styles.productDetail}>
            <strong>Fecha de entrada a cantidad crítica:</strong> {product.date}
          </p>
          <p style={styles.productDetail}>
            <strong>Cantidad en stock presumida:</strong> {Math.round(product.quantity)}
          </p>
          <p style={styles.productDetail}>
            <strong>Fecha de regularización:</strong> {product.regularizationDate}
          </p>
        </div>
      ))}
    </div>
  );
};
