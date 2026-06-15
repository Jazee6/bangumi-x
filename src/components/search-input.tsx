import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
	value: string;
	onSearch: (value: string) => void;
	placeholder?: string;
}

export function SearchInput({
	value,
	onSearch,
	placeholder = "搜索...",
}: SearchInputProps) {
	const [localValue, setLocalValue] = useState(value);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			onSearch(localValue);
		}
	};

	return (
		<div className="relative">
			<SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				value={localValue}
				onChange={(e) => setLocalValue(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				className="pl-9"
			/>
		</div>
	);
}
