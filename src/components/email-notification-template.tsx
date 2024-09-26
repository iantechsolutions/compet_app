interface NotificacionMailTemplateProps {
  productList: {
    productCode: string;
  }[];
}

export const NotificacionMailTemplate: React.FC<Readonly<NotificacionMailTemplateProps>> = ({ productList }) => {
  return (
    <div>
      {productList.map((product, index) => (
        <div key={index}>
          <h3>Notificacion de no entrada programada de producto: {product.productCode}</h3>
        </div>
      ))}
      ;
    </div>
  );
};
