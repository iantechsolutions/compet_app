import React from "react"; 

const HelpCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={24} height={24} color={"#aaaaaa"} fill={"#eeeeee"} {...props}>
    <circle cx="12" cy="12" r="11" stroke="none" strokeWidth="1.5" />
    <path  d="M9 7.5C9.75 6.5 11.25 6 12.5 6C13.75 6 15.25 7 15.25 8.25C15.25 9 14.5 9.75 13.25 11.25C12.5 11.85 12.25 12.25 12 12.85V13.4"
  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M11.992 17H12.001" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default HelpCircleIcon;